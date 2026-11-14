/**
 * Requests that UI pages send to the background service worker. Anything that only reads
 * or writes settings goes through the settings store instead; these are the operations
 * that need the background's privileges or state.
 */
export type Request =
  | { readonly type: 'forget-site'; readonly site: string }
  | { readonly type: 'purge-history' }
  | { readonly type: 'toggle-picture-in-picture'; readonly tabId: number }
  | { readonly type: 'adblock-status' }
  | { readonly type: 'site-of'; readonly url: string }
  | { readonly type: 'panic' }
  | ({ readonly type: 'clear-browsing-data' } & ClearDataRequest);

/** What to delete, from `since` (milliseconds since the epoch; 0 for all time) until now. */
export interface ClearDataRequest {
  readonly since: number;
  readonly history: boolean;
  /** Cookies and every kind of site storage. */
  readonly siteData: boolean;
  readonly cache: boolean;
  readonly downloads: boolean;
}

export interface ResponseMap {
  /** The registrable domain of a web URL, which needs the public suffix list. */
  'site-of': { readonly site: string | null };
  'forget-site': { readonly cookiesRemoved: number; readonly historyRemoved: number };
  'purge-history': { readonly removed: number };
  /** Whether tabs are now hidden, and how many were hidden or restored. */
  panic: { readonly hidden: boolean; readonly tabs: number };
  'clear-browsing-data': Record<string, never>;
  'toggle-picture-in-picture': { readonly ok: boolean };
  'adblock-status': {
    readonly error: string | null;
    readonly customRules: number;
    readonly rejected: readonly { line: number; text: string; reason: string }[];
    /** Static rules the browser can still enable, where it reports this. */
    readonly availableRules: number | null;
  };
}

type Envelope<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

export async function send<R extends Request>(request: R): Promise<ResponseMap[R['type']]> {
  const envelope = (await chrome.runtime.sendMessage(request)) as Envelope<ResponseMap[R['type']]>;
  if (!envelope.ok) throw new Error(envelope.error);
  return envelope.value;
}

export type Handlers = {
  [K in Request['type']]: (request: Extract<Request, { type: K }>) => Promise<ResponseMap[K]>;
};

/** Routes requests to `handlers`, rejecting anything not sent by this extension's pages. */
export function serve(handlers: Handlers): void {
  chrome.runtime.onMessage.addListener((message: Request, sender, sendResponse) => {
    // Extension pages only: content scripts run in web pages and must not reach these.
    const fromExtensionPage = sender.url?.startsWith(chrome.runtime.getURL('')) ?? false;
    if (sender.id !== chrome.runtime.id || !fromExtensionPage) return false;
    const handler = handlers[message.type] as (request: Request) => Promise<unknown>;
    if (handler === undefined) return false;
    handler(message).then(
      (value) => sendResponse({ ok: true, value }),
      (error: unknown) => sendResponse({ ok: false, error: String(error) }),
    );
    return true;
  });
}
