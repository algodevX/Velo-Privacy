type RegisteredContentScript = chrome.scripting.RegisteredContentScript;

interface Placement {
  readonly matches: string[];
  readonly excludeMatches: string[];
  readonly runAt: RegisteredContentScript['runAt'];
  readonly allFrames: boolean;
  /** Also run in about:blank and similar frames, which pages can use to reach clean APIs. */
  readonly matchOriginAsFallback?: boolean;
}

/** Scripts, in the extension's isolated world or the page's own, and stylesheets. */
export type ContentScript = Placement &
  (
    | {
        readonly js: string[];
        readonly world: RegisteredContentScript['world'];
        readonly css?: string[];
      }
    | { readonly css: string[] }
  );

/**
 * Registers `script` under `id`, replacing any previous registration, or unregisters `id`
 * when `script` is null. Registrations persist across browser restarts.
 */
export async function setContentScript(id: string, script: ContentScript | null): Promise<void> {
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (existing.length > 0) await chrome.scripting.unregisterContentScripts({ ids: [id] });
  if (script !== null) {
    await chrome.scripting.registerContentScripts([{ ...script, id, persistAcrossSessions: true }]);
  }
}
