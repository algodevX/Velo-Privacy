import type { CosmeticData } from '../filters/compile';

/**
 * Generic selectors split by what an element must carry to match them.
 *
 * Injecting every generic selector into every frame costs each page and iframe the parsing
 * of tens of thousands of rules. Instead, a small content script reports the class names
 * and ids that actually occur, and only selectors keyed by those are injected. This is the
 * approach Brave's ad blocker takes.
 */
export interface GenericSelectors {
  /** Selectors that are exactly one class (`.ad`) or id (`#ad`); each is its own key. */
  simple: string[];
  /** Longer selectors, keyed by the class or id they start with (`div.ad > img` → `.ad`). */
  keyed: Record<string, string[]>;
  /** Selectors without such a key, applied on every page. */
  unkeyed: string[];
}

/** Element-hiding data as published per list. */
export type CosmeticFile = Omit<CosmeticData, 'generic'> & { generic: GenericSelectors };

const SIMPLE = /^[.#][\w-]+$/;
// An optional tag name, then a class or id ending where the next part of the selector starts.
const LEADING_KEY = /^[a-z][a-z0-9-]*?([.#][\w-]+)(?=[\s.#:[>+~]|$)|^([.#][\w-]+)(?=[\s.#:[>+~])/i;

export function partitionGeneric(selectors: Iterable<string>): GenericSelectors {
  const result: GenericSelectors = { simple: [], keyed: {}, unkeyed: [] };
  for (const selector of selectors) {
    if (SIMPLE.test(selector)) {
      result.simple.push(selector);
      continue;
    }
    // Escapes and selector lists would need a CSS parser to key correctly.
    const match =
      selector.includes('\\') || selector.includes(',') ? null : LEADING_KEY.exec(selector);
    const key = match?.[1] ?? match?.[2];
    if (key === undefined) result.unkeyed.push(selector);
    else (result.keyed[key] ??= []).push(selector);
  }
  return result;
}

/** What to hide when a page starts loading, and whether to watch it for generic matches. */
export interface InitialHiding {
  selectors: string[];
  surveyGeneric: boolean;
}

/**
 * Answers "which selectors should be hidden on this host?", merged across every enabled
 * list and the user's own filters.
 */
export class CosmeticIndex {
  private readonly keyed = new Map<string, Set<string>>();
  private readonly unkeyed = new Set<string>();
  private readonly specific = new Map<string, Set<string>>();
  private readonly exceptions = new Map<string, Set<string>>();
  private readonly genericHide = new Set<string>();
  private readonly specificHide = new Set<string>();

  add(file: CosmeticFile): this {
    const { simple, keyed, unkeyed } = file.generic;
    for (const selector of simple) addTo(this.keyed, selector, selector);
    for (const [key, selectors] of Object.entries(keyed)) {
      for (const selector of selectors) addTo(this.keyed, key, selector);
    }
    for (const selector of unkeyed) this.unkeyed.add(selector);
    merge(this.specific, file.specific);
    merge(this.exceptions, file.exceptions);
    for (const host of file.genericHide) this.genericHide.add(host);
    for (const host of file.specificHide) this.specificHide.add(host);
    return this;
  }

  /** Adds compiled filters, such as the user's own, partitioning their generic selectors. */
  addCompiled(data: CosmeticData): this {
    return this.add({ ...data, generic: partitionGeneric(data.generic) });
  }

  initialFor(hostname: string): InitialHiding {
    const suffixes = hostSuffixes(hostname);
    const selectors = new Set<string>();
    if (!suffixes.some((host) => this.specificHide.has(host))) {
      for (const host of suffixes) for (const s of this.specific.get(host) ?? []) selectors.add(s);
    }
    const surveyGeneric = !suffixes.some((host) => this.genericHide.has(host));
    if (surveyGeneric) for (const selector of this.unkeyed) selectors.add(selector);
    return { selectors: this.withoutExceptions(selectors, suffixes), surveyGeneric };
  }

  /** Generic selectors keyed by any of `keys` (`.class` or `#id`) that apply on `hostname`. */
  genericFor(hostname: string, keys: readonly string[]): string[] {
    const suffixes = hostSuffixes(hostname);
    if (suffixes.some((host) => this.genericHide.has(host))) return [];
    const selectors = new Set<string>();
    for (const key of keys)
      for (const selector of this.keyed.get(key) ?? []) selectors.add(selector);
    return this.withoutExceptions(selectors, suffixes);
  }

  private withoutExceptions(selectors: Set<string>, suffixes: readonly string[]): string[] {
    for (const host of suffixes) {
      for (const selector of this.exceptions.get(host) ?? []) selectors.delete(selector);
    }
    return [...selectors];
  }
}

/** A stylesheet hiding `selectors`. One rule each, so one invalid selector cannot void the rest. */
export function hidingStylesheet(selectors: readonly string[]): string {
  return selectors.map((selector) => `${selector}{display:none!important}`).join('\n');
}

/** `a.b.example.com` -> `a.b.example.com`, `b.example.com`, `example.com`, `com`. */
export function hostSuffixes(hostname: string): string[] {
  const labels = hostname.toLowerCase().replace(/\.$/, '').split('.');
  return labels.map((_, index) => labels.slice(index).join('.'));
}

function addTo(map: Map<string, Set<string>>, key: string, value: string): void {
  const set = map.get(key);
  if (set) set.add(value);
  else map.set(key, new Set([value]));
}

function merge(target: Map<string, Set<string>>, source: Record<string, string[]>): void {
  for (const [host, selectors] of Object.entries(source)) {
    for (const selector of selectors) addTo(target, host, selector);
  }
}
