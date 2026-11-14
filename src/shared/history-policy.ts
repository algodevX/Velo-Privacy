import { hostnameOf } from './domains';
import { matchesHost, parseSitePatterns, type SitePattern } from './patterns';
import type { Settings } from './settings/schema';

export type HistoryVerdict =
  | { readonly keep: true }
  | { readonly keep: false; readonly reason: 'paused' | 'site' | 'keyword' };

export interface HistoryPolicy {
  readonly record: boolean;
  readonly sites: readonly SitePattern[];
  readonly keywords: readonly string[];
}

export function compileHistoryPolicy(history: Settings['history']): HistoryPolicy {
  return {
    record: history.record,
    sites: parseSitePatterns(history.excludedSites),
    keywords: history.excludedKeywords.map((keyword) => keyword.toLowerCase()),
  };
}

/**
 * Decides whether a page may stay in history. Site and keyword exclusions take precedence
 * over the pause switch because they remove every visit, not just the current one.
 */
export function judgeHistoryEntry(policy: HistoryPolicy, url: string, title = ''): HistoryVerdict {
  const host = hostnameOf(url);
  if (host !== null && policy.sites.some((pattern) => matchesHost(pattern, host))) {
    return { keep: false, reason: 'site' };
  }
  if (policy.keywords.length > 0) {
    const haystack = `${safeDecode(url)}\n${title}`.toLowerCase();
    if (policy.keywords.some((keyword) => haystack.includes(keyword))) {
      return { keep: false, reason: 'keyword' };
    }
  }
  return policy.record ? { keep: true } : { keep: false, reason: 'paused' };
}

/** Keywords should match "online banking" even when the URL spells it "online%20banking". */
function safeDecode(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}
