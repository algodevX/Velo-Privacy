import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  countBlocked,
  dynamicBlocks,
  type BlockedCounts,
  type MatchedRule,
} from '../../shared/adblock/blocked-counts';
import { FILTER_INDEX_PATH, type FilterIndex } from '../../shared/adblock/catalog';
import { cookieDecisionFor } from '../../shared/cookie-policy';
import { RULE_ID_RANGES, type Rule } from '../../shared/dnr';
import { hostnameOf } from '../../shared/domains';
import { compileHistoryPolicy, judgeHistoryEntry } from '../../shared/history-policy';
import { send } from '../../shared/messages';
import { PANIC_STASH_KEY, readPanicStash, type PanicStash } from '../../shared/panic';
import { detectCapabilities } from '../../shared/platform';
import { matchesHost, parseSitePatterns } from '../../shared/patterns';
import type { CookieAction, Settings } from '../../shared/settings/schema';
import { useClearData } from '../components/clear-data';
import { Button, IconButton, Select } from '../components/controls';
import { Icon, SiteIcon } from '../components/Icon';
import { SwitchRow } from '../components/layout';
import { useActiveTab, useSettings, type UpdateSettings } from '../hooks';
import type { IconName } from '../icons';
import { COOKIE_ACTIONS, COOKIE_ACTION_LABELS, plural } from '../labels';

const capabilities = detectCapabilities();

/**
 * The registrable domain of `url`, asked of the background so the popup does not bundle the
 * public suffix list. `undefined` while loading; `null` without a site.
 */
function useSiteOf(url: string | undefined): string | null | undefined {
  const [site, setSite] = useState<{ url: string | undefined; site: string | null }>();
  useEffect(() => {
    if (url === undefined) return;
    let current = true;
    void send({ type: 'site-of', url }).then((response) => {
      if (current) setSite({ url, site: response.site });
    });
    return () => {
      current = false;
    };
  }, [url]);
  if (url === undefined) return null;
  return site?.url === url ? site.site : undefined;
}

/**
 * Ads and trackers blocked in `tabId` since its page loaded. Undefined while loading, or
 * when the browser does not report matched rules.
 */
function useBlockedCounts(tabId: number | undefined): BlockedCounts | undefined {
  const [counts, setCounts] = useState<BlockedCounts>();
  useEffect(() => {
    if (tabId === undefined) return;
    const dnr: Partial<typeof chrome.declarativeNetRequest> = chrome.declarativeNetRequest;
    if (dnr.getMatchedRules === undefined || dnr.getDynamicRules === undefined) return;
    void Promise.all([
      dnr.getMatchedRules({ tabId }),
      dnr.getDynamicRules(),
      fetch(chrome.runtime.getURL(FILTER_INDEX_PATH)).then(
        (response) => response.json() as Promise<FilterIndex>,
      ),
    ])
      .then(([{ rulesMatchedInfo }, dynamicRules, index]) =>
        setCounts(
          countBlocked(
            rulesMatchedInfo.map((info): MatchedRule => info.rule),
            index,
            // RuleSpec mirrors the DNR types with plain strings; see shared/dnr.ts.
            dynamicBlocks(dynamicRules as unknown as Rule[], RULE_ID_RANGES),
          ),
        ),
      )
      .catch((error: unknown) => console.warn('Blocked counts unavailable:', error));
  }, [tabId]);
  return counts;
}

const openSettings = () => void chrome.runtime.openOptionsPage().then(() => window.close());

export function Popup() {
  const [settings, update] = useSettings();
  const tab = useActiveTab();
  const [needsReload, setNeedsReload] = useState(false);
  const url = tab?.url;
  const host = url?.startsWith('http') ? hostnameOf(url) : null;
  const site = useSiteOf(host === null ? undefined : url);
  if (settings === undefined || tab === undefined || site === undefined) return null;
  const page =
    host !== null && site !== null && url !== undefined && tab?.id !== undefined
      ? { host, site, url, tabId: tab.id }
      : null;

  /** Changes to a site's protections only reach pages loaded after them. */
  const updateSite: UpdateSettings = async (mutate) => {
    await update(mutate);
    setNeedsReload(true);
  };

  return (
    <main class="popup">
      <header class="popup-bar">
        <img src="icons/32.png" alt="" width={28} height={28} />
        <span class="popup-brand">Velo Privacy</span>
        <IconButton icon="settings" label="Settings" onClick={openSettings} />
      </header>

      {settings.panic.enabled && capabilities.bookmarks && <PanicButton />}

      {page ? (
        <SiteCard settings={settings} update={updateSite} {...page} />
      ) : (
        <p class="popup-empty">
          Velo can’t change this page. Open a website to see its protections here.
        </p>
      )}

      <div class="popup-list">
        {page && <SiteActions site={page.site} tabId={page.tabId} />}
        {capabilities.browsingData && <ClearBrowsingData />}
        {capabilities.history && (
          <SwitchRow
            icon="history_toggle_off"
            title="Record history"
            description={settings.history.record ? undefined : 'New visits aren’t kept'}
            checked={settings.history.record}
            onChange={(record) =>
              void update((draft) => {
                draft.history.record = record;
              })
            }
          />
        )}
      </div>

      {needsReload && page && (
        <div class="reload-bar" role="status">
          <span>Reload to apply your changes</span>
          <Button
            variant="text"
            onClick={() => {
              void chrome.tabs.reload(page.tabId);
              window.close();
            }}
          >
            Reload
          </Button>
        </div>
      )}
    </main>
  );
}

interface SiteCardProps {
  settings: Settings;
  update: UpdateSettings;
  host: string;
  site: string;
  url: string;
  tabId: number;
}

const DEFAULT = 'default';

/** Whether `host` is covered by one of `sources`, a site list from the settings. */
function listed(sources: readonly string[], host: string): boolean {
  return parseSitePatterns(sources, ['domain']).some((pattern) => matchesHost(pattern, host));
}

/** Adds `site` to a site list, or removes it. */
function toggled(sites: readonly string[], site: string, add: boolean): string[] {
  const others = sites.filter((entry) => entry !== site);
  return add ? [...others, site] : others;
}

function SiteCard({ settings, update, host, site, url, tabId }: SiteCardProps) {
  const counts = useBlockedCounts(tabId);
  const adsBlocked = settings.adblock.enabled && !listed(settings.adblock.disabledSites, host);
  const trackingBlocked = !listed(settings.tracking.allowedSites, host);
  const httpsOnly = settings.https.upgrade && !listed(settings.https.exceptions, host);

  const historyPolicy = compileHistoryPolicy({ ...settings.history, record: true });
  const keptInHistory = judgeHistoryEntry(historyPolicy, url).keep;
  const excludedHere = settings.history.excludedSites.includes(site);
  const excludedByOtherRule = !keptInHistory && !excludedHere;

  const protectedHere = adsBlocked || trackingBlocked;

  return (
    <section class="site-card" aria-label={`Protections for ${site}`}>
      <div class="site-header">
        <SiteIcon host={host} />
        <div class="row-text">
          <h1 class="site-name" title={host}>
            {site}
          </h1>
          <div class="site-status" data-state={protectedHere ? 'on' : 'off'}>
            {protectedHere ? 'Protected' : 'Protection is off for this site'}
          </div>
        </div>
      </div>

      <div class="toggles">
        <Toggle
          icon="block"
          label="Ads"
          state={
            settings.adblock.enabled
              ? adsBlocked
                ? blockedText(counts?.ads)
                : 'Allowed'
              : 'Off everywhere'
          }
          pressed={adsBlocked}
          disabled={!settings.adblock.enabled}
          onToggle={(block) =>
            void update((draft) => {
              draft.adblock.disabledSites = toggled(draft.adblock.disabledSites, site, !block);
            })
          }
        />
        <Toggle
          icon="fingerprint"
          label="Trackers"
          state={trackingBlocked ? blockedText(counts?.trackers) : 'Allowed'}
          pressed={trackingBlocked}
          onToggle={(block) =>
            void update((draft) => {
              draft.tracking.allowedSites = toggled(draft.tracking.allowedSites, site, !block);
            })
          }
        />
        {capabilities.history && (
          <Toggle
            icon="history"
            label="History"
            state={excludedByOtherRule ? 'Excluded by a rule' : keptInHistory ? 'Kept' : 'Not kept'}
            pressed={keptInHistory}
            disabled={excludedByOtherRule}
            onToggle={(keep) =>
              void update((draft) => {
                draft.history.excludedSites = toggled(draft.history.excludedSites, site, !keep);
              })
            }
          />
        )}
        <Toggle
          icon="encrypted"
          label="HTTPS only"
          state={
            settings.https.upgrade ? (httpsOnly ? 'On' : 'Allowed over HTTP') : 'Off everywhere'
          }
          pressed={httpsOnly}
          disabled={!settings.https.upgrade}
          onToggle={(on) =>
            void update((draft) => {
              draft.https.exceptions = toggled(draft.https.exceptions, site, !on);
            })
          }
        />
      </div>

      <CookieChoice settings={settings} update={update} host={host} site={site} />

      {settings.adblock.enabled && (
        <BrokenSite
          paused={!adsBlocked}
          onChange={(pause) =>
            void update((draft) => {
              draft.adblock.disabledSites = toggled(draft.adblock.disabledSites, site, pause);
            })
          }
        />
      )}
    </section>
  );
}

/** "12 blocked", or just "Blocked" while the count is unknown. */
function blockedText(count: number | undefined): string {
  return count === undefined ? 'Blocked' : `${count.toLocaleString()} blocked`;
}

/**
 * The way out when blocking breaks a page: pause ad blocking for the site, and the way
 * back once it is paused.
 */
function BrokenSite({ paused, onChange }: { paused: boolean; onChange: (pause: boolean) => void }) {
  return paused ? (
    <div class="broken-site broken-site-paused">
      <Icon name="info" />
      <span>Ad blocking is paused on this site</span>
      <Button variant="text" onClick={() => onChange(false)}>
        Turn back on
      </Button>
    </div>
  ) : (
    <div class="broken-site">
      <span>Site not working?</span>
      <Button variant="text" onClick={() => onChange(true)}>
        Pause ad blocking here
      </Button>
    </div>
  );
}

interface ToggleProps {
  icon: IconName;
  label: string;
  state: string;
  pressed: boolean;
  disabled?: boolean;
  onToggle: (pressed: boolean) => void;
}

/** A quick setting: a button that is filled while its protection is on. */
function Toggle({ icon, label, state, pressed, disabled, onToggle }: ToggleProps) {
  return (
    <button
      type="button"
      class="toggle"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => onToggle(!pressed)}
    >
      <Icon name={icon} size={24} />
      <span>
        <span class="toggle-label">{label}</span>
        <span class="toggle-state" style="display:block">
          {state}
        </span>
      </span>
    </button>
  );
}

const SITE_COOKIE_DESCRIPTIONS: Record<CookieAction, string> = {
  allow: 'Kept as usual',
  session: 'Deleted when you close the browser',
  tab: "Deleted when you close this site's tabs",
  block: "This site can't save data",
};

function CookieChoice({ settings, update, host, site }: Omit<SiteCardProps, 'url' | 'tabId'>) {
  const decision = cookieDecisionFor(host, settings.cookies);
  const ownRule = settings.cookies.rules.find((rule) => rule.pattern === site);
  const inherited = decision.rule !== undefined && decision.rule.rule.pattern !== site;
  return (
    <div>
      <span class="field-label">Cookies and site data</span>
      <Select
        label={`Cookies and site data for ${site}`}
        value={ownRule?.action ?? DEFAULT}
        options={[
          {
            value: DEFAULT,
            label: `Default (${COOKIE_ACTION_LABELS[settings.cookies.defaultAction]})`,
          },
          ...COOKIE_ACTIONS.map((action) => ({
            value: action,
            label: COOKIE_ACTION_LABELS[action],
          })),
        ]}
        onChange={(choice) =>
          void update((draft) => {
            const others = draft.cookies.rules.filter((rule) => rule.pattern !== site);
            draft.cookies.rules =
              choice === DEFAULT ? others : [...others, { pattern: site, action: choice }];
          })
        }
      />
      <p class="row-description" style="margin: 6px 4px 0">
        {inherited
          ? `Set by your rule for ${decision.rule?.rule.pattern}`
          : SITE_COOKIE_DESCRIPTIONS[decision.action]}
      </p>
    </div>
  );
}

function PanicButton() {
  const [stash, setStash] = useState<PanicStash | null>();
  useEffect(() => {
    void readPanicStash().then(setStash);
    const onChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (PANIC_STASH_KEY in changes) void readPanicStash().then(setStash);
    };
    chrome.storage.local.onChanged.addListener(onChange);
    return () => chrome.storage.local.onChanged.removeListener(onChange);
  }, []);
  if (stash === undefined) return null;
  return (
    <Button
      variant={stash === null ? 'danger' : 'filled'}
      icon={stash === null ? 'emergency_home' : 'restore_page'}
      onClick={() => void send({ type: 'panic' }).finally(() => window.close())}
    >
      {stash === null ? 'Panic: hide all tabs' : `Restore ${plural(stash.tabs, 'tab')}`}
    </Button>
  );
}

/** A row that expands into a small form within the popup. */
function ExpandingRow({
  icon,
  title,
  open,
  onOpen,
  children,
}: {
  icon: IconName;
  title: string;
  open: boolean;
  onOpen: () => void;
  children: ComponentChildren;
}) {
  if (open) return <div class="inline-panel">{children}</div>;
  return (
    <button type="button" class="row row-interactive" onClick={onOpen}>
      <Icon name={icon} class="row-icon" />
      <div class="row-text row-title">{title}</div>
    </button>
  );
}

function ClearBrowsingData() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string>();
  const { fields, nothingChosen, clear } = useClearData();
  return (
    <>
      <ExpandingRow
        icon="cleaning_services"
        title="Clear browsing data"
        open={open}
        onOpen={() => {
          setStatus(undefined);
          setOpen(true);
        }}
      >
        <p>Delete data from all sites</p>
        {fields}
        <div class="inline-actions">
          <Button variant="text" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={nothingChosen}
            onClick={() =>
              void clear().then(() => {
                setOpen(false);
                setStatus('Browsing data deleted');
              })
            }
          >
            Delete
          </Button>
        </div>
      </ExpandingRow>
      {status && (
        <p class="popup-status" role="status">
          {status}
        </p>
      )}
    </>
  );
}

function SiteActions({ site, tabId }: { site: string; tabId: number }) {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string>();

  const togglePip = async () => {
    const { ok } = await send({ type: 'toggle-picture-in-picture', tabId });
    if (ok) window.close();
    else setStatus('There’s no video playing on this page');
  };

  const forget = async () => {
    setConfirming(false);
    const { cookiesRemoved, historyRemoved } = await send({ type: 'forget-site', site });
    setStatus(
      `Deleted ${plural(cookiesRemoved, 'cookie')} and ${plural(historyRemoved, 'history entry', 'history entries')}`,
    );
  };

  return (
    <>
      <button type="button" class="row row-interactive" onClick={() => void togglePip()}>
        <Icon name="picture_in_picture_alt" class="row-icon" />
        <div class="row-text row-title">Picture-in-picture</div>
      </button>
      <ExpandingRow
        icon="delete"
        title={`Delete data for ${site}`}
        open={confirming}
        onOpen={() => setConfirming(true)}
      >
        <p>
          Delete cookies, site storage and history for {site}? You’ll be signed out, and this can’t
          be undone.
        </p>
        <div class="inline-actions">
          <Button variant="text" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void forget()}>
            Delete
          </Button>
        </div>
      </ExpandingRow>
      {status && (
        <p class="popup-status" role="status">
          {status}
        </p>
      )}
    </>
  );
}
