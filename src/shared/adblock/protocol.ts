/**
 * Messages between the element-hiding content script and the background. They come from
 * web pages' frames, so the background validates them and they can only ask for elements
 * to be hidden in the frame that sent them.
 */
export const HIDE_ELEMENTS = 'hide-elements';

export interface HideElementsRequest {
  readonly type: typeof HIDE_ELEMENTS;
  /** Class names (`.name`) and ids (`#name`) seen in the frame since the last request. */
  readonly keys: readonly string[];
  /** The frame's first request, sent as it starts loading. */
  readonly first: boolean;
}

export interface HideElementsResponse {
  /** Whether to keep reporting new class names and ids. */
  readonly survey: boolean;
}

/** Upper bounds that keep a hostile page from making the background do unbounded work. */
export const MAX_KEYS_PER_REQUEST = 2_000;
export const MAX_KEY_LENGTH = 256;

export function isHideElementsRequest(message: unknown): message is HideElementsRequest {
  if (typeof message !== 'object' || message === null) return false;
  const { type, keys, first } = message as Record<string, unknown>;
  return (
    type === HIDE_ELEMENTS &&
    typeof first === 'boolean' &&
    Array.isArray(keys) &&
    keys.length <= MAX_KEYS_PER_REQUEST &&
    keys.every((key) => typeof key === 'string' && key.length <= MAX_KEY_LENGTH)
  );
}
