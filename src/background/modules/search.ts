import { siteOf } from '../../shared/sites';
import { SEARCH_ENGINES, enabledEngines } from '../../shared/search/engines';
import { compileSearchRules } from '../../shared/search/rules';
import type { Settings } from '../../shared/settings/schema';
import type { Module } from '../module';
import { installRules } from '../rules';
import { debounced } from '../serial';
import { currentSettings } from '../settings-cache';
import { clearStorage, removeHostCookies } from '../site-data';
import type { TabSiteTracker } from '../tab-sites';

const CONSENT_COOKIE_NAMES = new Set(SEARCH_ENGINES.flatMap((e) => e.consentCookies ?? []));

/**
 * Search isolation and global search preferences. The request rewriting itself is
 * declarative (see shared/search/rules.ts); this module keeps those rules current and
 * wipes the storage of dedicated search hosts when the user is done searching.
 */
export function createSearchModule(tabSites: TabSiteTracker): Module {
  const apply = async ({ search }: Settings) => {
    await installRules('search', compileSearchRules(search, await consentHeaders(search)));
  };

  const refreshConsent = debounced(() => void currentSettings().then(apply), 1_000);

  return {
    name: 'search',
    sections: ['search'],

    listen() {
      // The user answered (or reset) a consent banner: replay the new answer.
      chrome.cookies.onChanged.addListener(({ cookie }) => {
        if (CONSENT_COOKIE_NAMES.has(cookie.name)) refreshConsent();
      });

      tabSites.onSiteClosed(async (site) => {
        const { search } = await currentSettings();
        if (!search.isolate) return;
        for (const engine of enabledEngines(search)) {
          if (!engine.dedicatedHosts || !engine.hosts.some((host) => siteOf(host) === site))
            continue;
          // Requests already carry no cookies; this removes those set by page scripts.
          await removeHostCookies(engine.hosts);
          await clearStorage(engine.hosts.map((host) => `https://${host}`));
        }
      });
    },

    apply,
  };
}

/** Reads the consent cookies that isolated requests should keep sending. */
async function consentHeaders(search: Settings['search']): Promise<Map<string, string>> {
  const headers = new Map<string, string>();
  if (!search.isolate || !search.preserveConsent) return headers;
  for (const engine of enabledEngines(search)) {
    const names = engine.consentCookies;
    if (names === undefined) continue;
    for (const host of engine.hosts) {
      const cookies = await chrome.cookies.getAll({ url: `https://${host}/` });
      const header = cookies
        .filter((cookie) => names.includes(cookie.name))
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join('; ');
      if (header !== '') headers.set(host, header);
    }
  }
  return headers;
}
