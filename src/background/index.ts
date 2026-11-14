import { serve } from '../shared/messages';
import { detectCapabilities } from '../shared/platform';
import type { Settings } from '../shared/settings/schema';
import { onSettingsChanged } from '../shared/settings/store';
import { siteOf } from '../shared/sites';
import type { Module } from './module';
import { createAdblockModule, readAdblockStatus } from './modules/adblock';
import { createBrowserModule } from './modules/browser';
import { createCookiesModule } from './modules/cookies';
import { createHistoryModule, purgeExcludedHistory } from './modules/history';
import { createHttpsModule } from './modules/https';
import { createMediaModule, togglePictureInPictureInTab } from './modules/media';
import { createPanicModule, togglePanic } from './modules/panic';
import { createSearchModule } from './modules/search';
import { createSitesModule } from './modules/sites';
import { createTrackingModule } from './modules/tracking';
import { clearBrowsingData } from './clear-data';
import { serialized } from './serial';
import { currentSettings, updateCachedSettings } from './settings-cache';
import { forgetSite } from './site-data';
import { TabSiteTracker } from './tab-sites';

const capabilities = detectCapabilities();
const tabSites = new TabSiteTracker();

// Modules whose browser APIs are missing are left out entirely; see shared/platform.ts.
const modules: readonly Module[] = [
  createCookiesModule(tabSites, capabilities),
  ...(capabilities.history ? [createHistoryModule(capabilities)] : []),
  createSearchModule(tabSites),
  createTrackingModule(),
  createHttpsModule(),
  createAdblockModule(),
  ...(capabilities.privacy ? [createBrowserModule()] : []),
  createMediaModule(),
  createSitesModule(),
  ...(capabilities.bookmarks ? [createPanicModule()] : []),
];

/** Settings as last applied during this worker's lifetime; undefined forces a full apply. */
let applied: Settings | undefined;

const sync = serialized(async (settings: Settings) => {
  for (const module of modules) {
    const changed =
      applied === undefined ||
      module.sections.some(
        (section) => JSON.stringify(applied?.[section]) !== JSON.stringify(settings[section]),
      );
    if (!changed) continue;
    try {
      await module.apply(settings);
    } catch (error) {
      console.error(`Applying ${module.name} settings failed`, error);
    }
  }
  applied = settings;
});

// Listeners must be registered synchronously at startup for events to wake the worker.
tabSites.listen();
for (const module of modules) module.listen?.();

chrome.runtime.onInstalled.addListener(({ reason }) => {
  applied = undefined;
  void currentSettings().then(sync);
  if (reason === 'install') void chrome.runtime.openOptionsPage();
});

chrome.runtime.onStartup.addListener(() => {
  applied = undefined;
  void currentSettings().then(sync);
});

onSettingsChanged((settings) => {
  updateCachedSettings(settings);
  void sync(settings);
});

serve({
  'site-of': async ({ url }) => ({ site: siteOf(url) }),
  panic: () => togglePanic(),
  'clear-browsing-data': async (request) => {
    await clearBrowsingData(request);
    return {};
  },
  'forget-site': async ({ site }) =>
    forgetSite(site, { origins: await tabSites.originsOf(site), history: true }),
  'purge-history': async () => ({
    removed: await purgeExcludedHistory((await currentSettings()).history),
  }),
  'toggle-picture-in-picture': async ({ tabId }) => ({
    ok: await togglePictureInPictureInTab(tabId),
  }),
  'adblock-status': async () => {
    const dnr: Partial<typeof chrome.declarativeNetRequest> = chrome.declarativeNetRequest;
    const availableRules = dnr.getAvailableStaticRuleCount
      ? await dnr.getAvailableStaticRuleCount()
      : null;
    return { ...(await readAdblockStatus()), availableRules };
  },
});
