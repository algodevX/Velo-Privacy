import { FILTER_LISTS, cosmeticDataPath } from '../../shared/adblock/catalog';
import {
  CosmeticIndex,
  hidingStylesheet,
  type CosmeticFile,
} from '../../shared/adblock/cosmetic-index';
import {
  isHideElementsRequest,
  type HideElementsRequest,
  type HideElementsResponse,
} from '../../shared/adblock/protocol';
import { PRIORITY, type RuleSpec } from '../../shared/dnr';
import { hostnameOf } from '../../shared/domains';
import {
  compileFilterList,
  type CompileResult,
  type RejectedFilter,
} from '../../shared/filters/compile';
import {
  domainMatchPattern,
  domainsOf,
  matchesHost,
  parseSitePatterns,
} from '../../shared/patterns';
import type { Settings } from '../../shared/settings/schema';
import { setContentScript } from '../content-scripts';
import type { Module } from '../module';
import { installRules } from '../rules';
import { currentSettings } from '../settings-cache';

const STATUS_KEY = 'adblock.status';
const HIDING_SCRIPT_ID = 'adblock-hiding';
const MAX_CUSTOM_REGEX_RULES = 100;
const MAX_REPORTED_REJECTIONS = 50;

export interface AdblockStatus {
  /** Why the selected lists could not all be enabled, if they could not. */
  readonly error: string | null;
  readonly customRules: number;
  readonly rejected: readonly RejectedFilter[];
}

type Adblock = Settings['adblock'];
type Sender = chrome.runtime.MessageSender;

/**
 * Filter-list ad blocking.
 *
 * Network filters are compiled at build time into static rulesets, which this module only
 * switches on and off. Element hiding is driven by a small content script: when a frame
 * starts loading it asks for the site's selectors, then reports class names and ids as
 * they appear, and the matching generic selectors are injected as a user stylesheet. The
 * user's own filters go through the same compiler at runtime.
 */
export function createAdblockModule(): Module {
  let cosmetic: { key: string; index: Promise<CosmeticIndex> } | undefined;

  const cosmeticIndex = (adblock: Adblock): Promise<CosmeticIndex> => {
    const key = JSON.stringify([adblock.lists, adblock.customFilters]);
    if (cosmetic?.key !== key) cosmetic = { key, index: buildCosmeticIndex(adblock) };
    return cosmetic.index;
  };

  const hideElements = async (
    request: HideElementsRequest,
    sender: Sender,
  ): Promise<HideElementsResponse> => {
    const tabId = sender.tab?.id;
    const host = sender.url === undefined ? null : hostnameOf(sender.url);
    if (tabId === undefined || sender.frameId === undefined || host === null) {
      return { survey: false };
    }
    const { adblock } = await currentSettings();
    if (!adblock.enabled || !adblock.hideElements || isDisabledOn(adblock, host)) {
      return { survey: false };
    }
    const index = await cosmeticIndex(adblock);
    let survey = true;
    let selectors = index.genericFor(host, request.keys);
    if (request.first) {
      const initial = index.initialFor(host);
      survey = initial.surveyGeneric;
      selectors = [...initial.selectors, ...(survey ? selectors : [])];
    }
    if (selectors.length > 0) {
      await chrome.scripting
        .insertCSS({
          target: { tabId, frameIds: [sender.frameId] },
          css: hidingStylesheet(selectors),
          origin: 'USER',
        })
        .catch(() => undefined); // The frame may already be gone.
    }
    return { survey };
  };

  return {
    name: 'adblock',
    sections: ['adblock'],

    listen() {
      chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
        // Sent by Velo's content script from web pages; nothing else is accepted here.
        if (sender.id !== chrome.runtime.id || !isHideElementsRequest(message)) return false;
        hideElements(message, sender).then(sendResponse, () => sendResponse({ survey: false }));
        return true;
      });
    },

    async apply({ adblock }) {
      const error = await enableRulesets(adblock);
      const custom = await compileCustomFilters(adblock.customFilters);
      const rules = adblock.enabled ? [...siteExceptionRules(adblock), ...custom.rules] : [];
      await installRules('adblock', rules);
      await registerHidingScript(adblock);

      const status: AdblockStatus = {
        error,
        customRules: custom.rules.length,
        rejected: custom.rejected,
      };
      await chrome.storage.session.set({ [STATUS_KEY]: status });
    },
  };
}

export async function readAdblockStatus(): Promise<AdblockStatus> {
  const stored = await chrome.storage.session.get(STATUS_KEY);
  return (
    (stored[STATUS_KEY] as AdblockStatus | undefined) ?? {
      error: null,
      customRules: 0,
      rejected: [],
    }
  );
}

/** Switches the static rulesets to match the selected lists; returns an error message on failure. */
async function enableRulesets(adblock: Adblock): Promise<string | null> {
  const known = new Set(FILTER_LISTS.map((list) => list.id));
  const wanted = adblock.enabled ? adblock.lists.filter((id) => known.has(id)) : [];
  const enabled = await chrome.declarativeNetRequest.getEnabledRulesets();
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: wanted.filter((id) => !enabled.includes(id)),
      disableRulesetIds: enabled.filter((id) => !wanted.includes(id)),
    });
    return null;
  } catch (error) {
    console.warn('Filter lists could not all be enabled', error);
    return 'The browser has no room for all selected lists. Turn some off and try again.';
  }
}

/** Ad blocking off for a site: allow everything on its pages, below Velo's other protections. */
function siteExceptionRules(adblock: Adblock): RuleSpec[] {
  const domains = domainsOf(adblock.disabledSites);
  if (domains.length === 0) return [];
  return [
    {
      priority: PRIORITY.adblockSiteException,
      action: { type: 'allowAllRequests' },
      condition: { requestDomains: domains, resourceTypes: ['main_frame', 'sub_frame'] },
    },
  ];
}

/** The element-hiding script runs everywhere except where ad blocking is off. */
async function registerHidingScript(adblock: Adblock): Promise<void> {
  await setContentScript(
    HIDING_SCRIPT_ID,
    adblock.enabled && adblock.hideElements
      ? {
          js: ['content/cosmetic.js'],
          world: 'ISOLATED',
          matches: ['<all_urls>'],
          excludeMatches: domainsOf(adblock.disabledSites).map(domainMatchPattern),
          runAt: 'document_start',
          allFrames: true,
        }
      : null,
  );
}

/**
 * Compiles the user's filters, keeping only regular expressions the browser accepts. One
 * expression it rejects would make the whole rule update fail, so each is checked first.
 */
async function compileCustomFilters(text: string): Promise<CompileResult> {
  const lines = text.split('\n');
  const candidates = compileFilterList(lines, {
    isRegexSupported: () => true,
    maxRegexRules: MAX_CUSTOM_REGEX_RULES,
  }).rules.flatMap(({ condition }) =>
    condition.regexFilter === undefined
      ? []
      : [
          {
            regex: condition.regexFilter,
            caseSensitive: condition.isUrlFilterCaseSensitive ?? false,
          },
        ],
  );
  const supported = new Set<string>();
  await Promise.all(
    candidates.map(async ({ regex, caseSensitive }) => {
      if (await isRegexSupported(regex, caseSensitive))
        supported.add(regexKey(regex, caseSensitive));
    }),
  );
  return compileFilterList(lines, {
    isRegexSupported: (regex, caseSensitive) => supported.has(regexKey(regex, caseSensitive)),
    maxRegexRules: MAX_CUSTOM_REGEX_RULES,
    keepRejected: MAX_REPORTED_REJECTIONS,
  });
}

async function isRegexSupported(regex: string, isCaseSensitive: boolean): Promise<boolean> {
  // Not every browser can check; without the check, regular expressions are not used.
  const api: Partial<typeof chrome.declarativeNetRequest> = chrome.declarativeNetRequest;
  if (api.isRegexSupported === undefined) return false;
  const result = await api.isRegexSupported({ regex, isCaseSensitive, requireCapturing: false });
  return result.isSupported;
}

const regexKey = (regex: string, caseSensitive: boolean) => `${caseSensitive ? 'i' : 'I'}${regex}`;

async function buildCosmeticIndex(adblock: Adblock): Promise<CosmeticIndex> {
  const index = new CosmeticIndex();
  const known = new Set(FILTER_LISTS.map((list) => list.id));
  const files = await Promise.all(
    adblock.lists
      .filter((id) => known.has(id))
      .map((id) => loadJson<CosmeticFile>(cosmeticDataPath(id))),
  );
  for (const file of files) index.add(file);
  index.addCompiled(compileFilterList(adblock.customFilters.split('\n')).cosmetic);
  return index;
}

function isDisabledOn(adblock: Adblock, host: string): boolean {
  return parseSitePatterns(adblock.disabledSites, ['domain']).some((p) => matchesHost(p, host));
}

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(chrome.runtime.getURL(path));
  return (await response.json()) as T;
}
