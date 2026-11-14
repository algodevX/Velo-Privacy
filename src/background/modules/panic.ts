import { PANIC_STASH_KEY, isEmptyPage, readPanicStash, type PanicStash } from '../../shared/panic';
import type { Module } from '../module';
import { serialized } from '../serial';
import { currentSettings } from '../settings-cache';

export const PANIC_COMMAND = 'panic';

export interface PanicState {
  hidden: boolean;
  tabs: number;
}

/**
 * The panic button: hides every open tab in a bookmark folder, leaving a single new tab,
 * and brings them back on the next press. Needs the optional bookmarks permission, which
 * the settings page asks for when the button is switched on.
 */
export function createPanicModule(): Module {
  return {
    name: 'panic',
    sections: ['panic'],

    listen() {
      chrome.commands.onCommand.addListener((command) => {
        if (command !== PANIC_COMMAND) return;
        void currentSettings().then(({ panic }) => {
          if (panic.enabled) void togglePanic();
        });
      });
    },

    async apply() {
      // Nothing to set up: the button acts only when pressed.
    },
  };
}

export const togglePanic = serialized(async (): Promise<PanicState> => {
  if (chrome.bookmarks === undefined) throw new Error('The bookmarks permission is not granted');
  const stash = await readPanicStash();
  return stash === null ? hideTabs() : restoreTabs(stash);
});

async function hideTabs(): Promise<PanicState> {
  // Private windows are left alone: their pages must not end up in bookmarks.
  const windows = (await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] })).filter(
    (window) => !window.incognito,
  );
  const target = windows.find((window) => window.focused) ?? windows[0];
  const tabs = windows.flatMap((window) => window.tabs ?? []);
  if (target?.id === undefined || tabs.length === 0) return { hidden: false, tabs: 0 };

  const folder = await chrome.bookmarks.create({
    title: `Saved tabs, ${new Date().toLocaleString()}`,
  });
  let saved = 0;
  for (const tab of tabs) {
    const url = tab.pendingUrl ?? tab.url;
    if (url === undefined || isEmptyPage(url)) continue;
    try {
      await chrome.bookmarks.create({ parentId: folder.id, title: tab.title || url, url });
      saved++;
    } catch {
      // Browser pages such as settings cannot be bookmarked; they are closed all the same.
    }
  }

  const blank = await chrome.tabs.create({ windowId: target.id, active: true });
  const stash: PanicStash = { folderId: folder.id, tabs: saved, blankTabId: blank.id ?? null };
  await chrome.storage.local.set({ [PANIC_STASH_KEY]: stash });
  await chrome.tabs.remove(tabs.flatMap((tab) => (tab.id === undefined ? [] : [tab.id])));
  return { hidden: true, tabs: saved };
}

async function restoreTabs(stash: PanicStash): Promise<PanicState> {
  // The folder may have been deleted by hand; then there is nothing left to restore.
  const bookmarks = await chrome.bookmarks.getChildren(stash.folderId).catch(() => []);
  const window = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
  let restored = 0;
  for (const bookmark of bookmarks) {
    if (bookmark.url === undefined) continue;
    await chrome.tabs.create({ windowId: window.id, url: bookmark.url, active: restored === 0 });
    restored++;
  }

  if (restored > 0 && stash.blankTabId !== null) {
    const blank = await chrome.tabs.get(stash.blankTabId).catch(() => undefined);
    if (blank && isEmptyPage(blank.pendingUrl ?? blank.url ?? '')) {
      await chrome.tabs.remove(stash.blankTabId);
    }
  }
  await chrome.bookmarks.removeTree(stash.folderId).catch(() => undefined);
  await chrome.storage.local.remove(PANIC_STASH_KEY);
  return { hidden: false, tabs: restored };
}
