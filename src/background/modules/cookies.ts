import {
  compileCookieRules,
  contentSettingFor,
  decideCookieAction,
  type CompiledCookieRule,
} from '../../shared/cookie-policy';
import { hostnameOf } from '../../shared/domains';
import { siteOf } from '../../shared/sites';
import { domainContentSettingsPattern, hostContentSettingsPattern } from '../../shared/patterns';
import type { Capabilities } from '../../shared/platform';
import type { CookieAction, Settings } from '../../shared/settings/schema';
import type { Module } from '../module';
import { serialized } from '../serial';
import { currentSettings } from '../settings-cache';
import { forgetSite, removeCookie } from '../site-data';
import type { TabSiteTracker } from '../tab-sites';

/** Hosts given their own content setting because a wildcard or regex rule matched them. */
const MATERIALIZED_KEY = 'cookies.materialized';
const MAX_MATERIALIZED_HOSTS = 5_000;

type Materialized = Record<string, CookieAction>;

/**
 * Enforces cookie rules.
 *
 * Where the browser has content settings (Chromium), domain rules map one-to-one onto
 * them and are enforced natively before any cookie is stored. Content settings cannot
 * express wildcards or regular expressions, so those rules are "materialized": the first
 * time a matching host is navigated to, it receives a content setting of its own.
 *
 * Everywhere, a cookie listener removes cookies the moment a site set to `block` stores
 * them. That covers the instant before a materialized setting takes effect and, in
 * browsers without content settings (Firefox, Safari), is the enforcement itself; there,
 * `session` sites are also cleaned when the browser starts.
 *
 * The `tab` action is built on top: such sites are allowed, and their data is removed
 * when the last tab showing them closes.
 */
export function createCookiesModule(tabSites: TabSiteTracker, capabilities: Capabilities): Module {
  const native = capabilities.contentSettings;
  let compiled: { source: Settings['cookies']; rules: CompiledCookieRule[] } | undefined;

  const rulesFor = (cookies: Settings['cookies']): CompiledCookieRule[] => {
    if (compiled?.source !== cookies) {
      compiled = { source: cookies, rules: compileCookieRules(cookies.rules) };
    }
    return compiled.rules;
  };

  const decide = (host: string, cookies: Settings['cookies']) =>
    decideCookieAction(host, rulesFor(cookies), cookies.defaultAction);

  const materialize = serialized(async (host: string) => {
    if (!native) return;
    const { cookies } = await currentSettings();
    const decision = decide(host, cookies);
    if (decision.rule === undefined || decision.rule.pattern.kind === 'domain') return;

    const materialized = await loadMaterialized();
    if (materialized[host] === decision.action) return;
    if (Object.keys(materialized).length >= MAX_MATERIALIZED_HOSTS) return;

    await chrome.contentSettings.cookies.set({
      primaryPattern: hostContentSettingsPattern(host),
      setting: contentSettingFor(decision.action),
    });
    materialized[host] = decision.action;
    await chrome.storage.local.set({ [MATERIALIZED_KEY]: materialized });
  });

  const apply = serialized(async (settings: Settings) => {
    if (!native) return;
    const { cookies } = settings;
    const rules = rulesFor(cookies);

    // Content settings set by an extension can only be cleared as a whole, so the full set
    // is rebuilt. Specificity, not order, decides between overlapping patterns.
    await chrome.contentSettings.cookies.clear({});
    await chrome.contentSettings.cookies.set({
      primaryPattern: '<all_urls>',
      setting: contentSettingFor(cookies.defaultAction),
    });
    for (const { rule, pattern } of rules) {
      if (pattern.kind !== 'domain') continue;
      await chrome.contentSettings.cookies.set({
        primaryPattern: domainContentSettingsPattern(pattern.domain),
        setting: contentSettingFor(rule.action),
      });
    }

    // Re-decide previously materialized hosts against the new rules.
    const materialized: Materialized = {};
    for (const host of Object.keys(await loadMaterialized())) {
      const decision = decide(host, cookies);
      if (decision.rule === undefined || decision.rule.pattern.kind === 'domain') continue;
      await chrome.contentSettings.cookies.set({
        primaryPattern: hostContentSettingsPattern(host),
        setting: contentSettingFor(decision.action),
      });
      materialized[host] = decision.action;
    }
    await chrome.storage.local.set({ [MATERIALIZED_KEY]: materialized });
  });

  /**
   * Runs at browser start. Removes data of sites set to `tab` that have no open tab, and,
   * without native session cookies, of sites set to `session`.
   */
  const sweep = async () => {
    const { cookies } = await currentSettings();
    const open = await tabSites.openSites();
    const sites = new Set(
      (await chrome.cookies.getAll({})).flatMap((cookie) => {
        const site = siteOf(cookie.domain.replace(/^\./, ''));
        return site === null ? [] : [site];
      }),
    );
    for (const site of sites) {
      const action = decide(site, cookies).action;
      const expired = (action === 'tab' && !open.has(site)) || (action === 'session' && !native);
      if (expired) await forgetSite(site, { history: false });
    }
  };

  return {
    name: 'cookies',
    sections: ['cookies'],

    listen() {
      chrome.webNavigation.onBeforeNavigate.addListener(({ url }) => {
        const host = hostnameOf(url);
        if (host !== null) void materialize(host);
      });

      chrome.cookies.onChanged.addListener(({ removed, cookie }) => {
        if (removed) return;
        void (async () => {
          const { cookies } = await currentSettings();
          const host = cookie.domain.replace(/^\./, '');
          if (decide(host, cookies).action !== 'block') return;
          await removeCookie(cookie);
        })();
      });

      tabSites.onSiteClosed(async (site) => {
        const { cookies } = await currentSettings();
        if (decide(site, cookies).action !== 'tab') return;
        await forgetSite(site, { origins: await tabSites.originsOf(site), history: false });
      });

      chrome.runtime.onStartup.addListener(() => void sweep());
    },

    apply,
  };
}

async function loadMaterialized(): Promise<Materialized> {
  const stored = await chrome.storage.local.get(MATERIALIZED_KEY);
  return (stored[MATERIALIZED_KEY] as Materialized | undefined) ?? {};
}
