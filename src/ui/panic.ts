import type { UpdateSettings } from './hooks';

const BOOKMARKS: chrome.permissions.Permissions = { permissions: ['bookmarks'] };

/**
 * Switches the panic button on or off. It keeps hidden tabs in bookmarks, so switching it
 * on first asks for that permission; it must be called from a click for the browser to ask.
 */
export async function setPanicEnabled(update: UpdateSettings, enabled: boolean): Promise<void> {
  if (enabled && !(await chrome.permissions.request(BOOKMARKS))) return;
  await update((draft) => {
    draft.panic.enabled = enabled;
  });
}
