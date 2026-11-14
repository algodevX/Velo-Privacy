/**
 * Reports the class names and ids that appear in this frame, so the background can hide
 * the generic ad selectors that could match them. Runs in the isolated world from
 * document_start. It never touches the page: hiding happens in a user stylesheet the
 * background injects, which pages can neither see nor remove.
 */
import {
  HIDE_ELEMENTS,
  MAX_KEYS_PER_REQUEST,
  MAX_KEY_LENGTH,
  type HideElementsRequest,
  type HideElementsResponse,
} from '../shared/adblock/protocol';

/** Waits this long to batch names from further DOM changes into one request. */
const BATCH_DELAY_MS = 100;

const seen = new Set<string>();
const pending: string[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

function note(key: string): void {
  if (key.length > MAX_KEY_LENGTH || seen.has(key)) return;
  seen.add(key);
  pending.push(key);
  timer ??= setTimeout(flush, BATCH_DELAY_MS);
}

function noteElement(element: Element): void {
  if (element.id !== '') note(`#${element.id}`);
  for (const name of element.classList) note(`.${name}`);
}

function noteTree(root: Element): void {
  noteElement(root);
  for (const element of root.querySelectorAll('[id],[class]')) noteElement(element);
}

async function send(keys: string[], first: boolean): Promise<boolean> {
  const request: HideElementsRequest = { type: HIDE_ELEMENTS, keys, first };
  const response = (await chrome.runtime.sendMessage(request).catch(() => undefined)) as
    HideElementsResponse | undefined;
  return response?.survey ?? false;
}

function flush(): void {
  timer = undefined;
  while (pending.length > 0) {
    void send(pending.splice(0, MAX_KEYS_PER_REQUEST), false);
  }
}

function survey(): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        noteElement(mutation.target as Element);
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) noteTree(node as Element);
      }
    }
  });
  observer.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'id'],
  });
  if (document.documentElement) noteTree(document.documentElement);
}

// The first request hides site-specific elements before the page renders and says whether
// generic hiding applies here at all; where it does not, nothing is observed.
void send([], true).then((keepSurveying) => {
  if (keepSurveying) survey();
});
