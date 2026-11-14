/**
 * What the running browser supports.
 *
 * Velo ships one codebase to Chromium browsers, Firefox and Safari. APIs differ between
 * them, so features are gated on the APIs actually present rather than on browser names:
 * the background skips what it cannot do, and the UI hides settings that would do nothing.
 */
export interface Capabilities {
  /** Native per-site cookie rules (Chromium). Elsewhere they are enforced via the cookies API. */
  readonly contentSettings: boolean;
  readonly history: boolean;
  readonly downloads: boolean;
  /** Removing site storage and cache (not available in Safari). */
  readonly browsingData: boolean;
  /** Browser-level privacy preferences (chrome.privacy). */
  readonly privacy: boolean;
  /** Bookmarks, needed by the panic button (not available in Safari). */
  readonly bookmarks: boolean;
  /**
   * A Chromium-based browser, recognised by its extension URL scheme. Only used where
   * Chromium offers something with no API to detect it by, such as its settings pages.
   */
  readonly chromium: boolean;
}

export function detectCapabilities(): Capabilities {
  // The typings declare every namespace as present; at runtime some are not.
  const api: Partial<typeof chrome> = chrome;
  return {
    contentSettings: api.contentSettings?.cookies !== undefined,
    history: api.history !== undefined,
    downloads: api.downloads !== undefined,
    browsingData: api.browsingData !== undefined,
    privacy: api.privacy !== undefined,
    // An optional permission: the API itself only appears once it is granted.
    bookmarks: chrome.runtime.getManifest().optional_permissions?.includes('bookmarks') ?? false,
    chromium: chrome.runtime.getURL('').startsWith('chrome-extension:'),
  };
}

/** Whether a chrome.privacy preference exists in this browser. */
export function hasPrivacySetting(
  group: 'network' | 'services' | 'websites',
  name: string,
): boolean {
  const api: Partial<typeof chrome> = chrome;
  const settings = api.privacy?.[group] as Record<string, unknown> | undefined;
  return settings?.[name] !== undefined;
}
