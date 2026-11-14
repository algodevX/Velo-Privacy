import { siteOf } from '../shared/sites';
import { serialized } from './serial';

interface TabSiteState {
  /** Site shown by each tab. Keys are tab ids. */
  tabs: Record<string, string>;
  /** Origins seen per site, so their storage can be found and removed later. */
  origins: Record<string, string[]>;
}

const STORAGE_KEY = 'tabSites';
const MAX_ORIGINS_PER_SITE = 64;

type SiteClosedListener = (site: string) => Promise<void>;

/**
 * Tracks which site every regular (non-private) tab shows and reports when the last tab
 * showing a site goes away. State lives in session storage, so it survives the service
 * worker being suspended but not the browser restarting.
 */
export class TabSiteTracker {
  private readonly listeners: SiteClosedListener[] = [];

  onSiteClosed(listener: SiteClosedListener): void {
    this.listeners.push(listener);
  }

  listen(): void {
    chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
      if (change.url !== undefined && !tab.incognito) void this.record(tabId, change.url);
    });
    chrome.tabs.onRemoved.addListener((tabId) => void this.record(tabId, undefined));
    chrome.tabs.onReplaced.addListener((_added, removed) => void this.record(removed, undefined));
    chrome.runtime.onStartup.addListener(() => void this.rebuild());
    chrome.runtime.onInstalled.addListener(() => void this.rebuild());
  }

  /** Origins recorded for `site` during this browser session. */
  async originsOf(site: string): Promise<string[]> {
    return (await this.load()).origins[site] ?? [];
  }

  /** Sites shown in at least one regular tab, according to the browser itself. */
  async openSites(): Promise<Set<string>> {
    const tabs = await chrome.tabs.query({});
    return new Set(
      tabs.flatMap((tab) => {
        const site = !tab.incognito && tab.url ? siteOf(tab.url) : null;
        return site === null ? [] : [site];
      }),
    );
  }

  private readonly record = serialized(async (tabId: number, url: string | undefined) => {
    const state = await this.load();
    const key = String(tabId);
    const previous = state.tabs[key];
    const next = url === undefined ? null : siteOf(url);

    if (next === null) {
      const { [key]: _closed, ...remaining } = state.tabs;
      state.tabs = remaining;
    } else {
      state.tabs[key] = next;
      addOrigin(state, next, url);
    }
    await chrome.storage.session.set({ [STORAGE_KEY]: state });

    if (previous !== undefined && previous !== next && !(await this.openSites()).has(previous)) {
      await Promise.allSettled(this.listeners.map((listener) => listener(previous)));
    }
  });

  private readonly rebuild = serialized(async () => {
    const state: TabSiteState = { tabs: {}, origins: {} };
    for (const tab of await chrome.tabs.query({})) {
      const site = !tab.incognito && tab.url ? siteOf(tab.url) : null;
      if (tab.id === undefined || site === null) continue;
      state.tabs[String(tab.id)] = site;
      addOrigin(state, site, tab.url);
    }
    await chrome.storage.session.set({ [STORAGE_KEY]: state });
  });

  private async load(): Promise<TabSiteState> {
    const stored = await chrome.storage.session.get(STORAGE_KEY);
    return (stored[STORAGE_KEY] as TabSiteState | undefined) ?? { tabs: {}, origins: {} };
  }
}

function addOrigin(state: TabSiteState, site: string, url: string | undefined): void {
  if (url === undefined) return;
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return;
  }
  const origins = (state.origins[site] ??= []);
  if (!origins.includes(origin) && origins.length < MAX_ORIGINS_PER_SITE) origins.push(origin);
}
