/**
 * State of the panic button, kept in local storage so tabs can be restored after a
 * browser restart. Written by the background script, read by the popup.
 */
export const PANIC_STASH_KEY = 'panic-stash';

export interface PanicStash {
  /** The bookmark folder holding the hidden tabs. */
  folderId: string;
  tabs: number;
  /** The empty tab left open, closed again on restore if it is still empty. */
  blankTabId: number | null;
}

export async function readPanicStash(): Promise<PanicStash | null> {
  const stored = await chrome.storage.local.get(PANIC_STASH_KEY);
  return (stored[PANIC_STASH_KEY] as PanicStash | undefined) ?? null;
}

/** New-tab and blank pages, which are neither saved nor worth restoring. */
export function isEmptyPage(url: string): boolean {
  return /^(?:[a-z-]+:\/\/(?:newtab|new-tab-page|startpageshared)\/?$|about:(?:blank|newtab|home)$)/.test(
    url,
  );
}
