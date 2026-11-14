/**
 * Site patterns: the single syntax used wherever a setting targets websites.
 *
 *   example.com      example.com and all of its subdomains
 *   *.example.com    same as above; accepted because people expect it to work
 *   google.*         wildcard; `*` matches any run of characters, dots included
 *   /^ads?\d*\./     regular expression, tested case-insensitively against the hostname
 *
 * A pasted URL is reduced to its hostname.
 */

export type PatternKind = 'domain' | 'wildcard' | 'regex';

export type SitePattern =
  | { readonly kind: 'domain'; readonly source: string; readonly domain: string }
  | { readonly kind: 'wildcard'; readonly source: string; readonly regex: RegExp }
  | { readonly kind: 'regex'; readonly source: string; readonly regex: RegExp };

export type ParseResult =
  | { readonly ok: true; readonly pattern: SitePattern }
  | { readonly ok: false; readonly error: string };

const ALL_KINDS: readonly PatternKind[] = ['domain', 'wildcard', 'regex'];
const LABEL = /^(?!-)[a-z0-9_-]{1,63}(?<!-)$/;
const WILDCARD_CHARS = /^[a-z0-9._*-]+$/;

export function parseSitePattern(
  input: string,
  allowed: readonly PatternKind[] = ALL_KINDS,
): ParseResult {
  const source = input.trim();
  if (source === '') return fail('Enter a site, for example example.com');

  if (source.length > 2 && source.startsWith('/') && source.endsWith('/')) {
    if (!allowed.includes('regex')) return fail('Regular expressions are not supported here');
    try {
      return ok({ kind: 'regex', source, regex: new RegExp(source.slice(1, -1), 'i') });
    } catch (error) {
      return fail(`Invalid regular expression: ${(error as Error).message}`);
    }
  }

  let host = hostFromInput(source.toLowerCase());
  if (host.startsWith('*.')) host = host.slice(2);

  if (host.includes('*')) {
    if (!allowed.includes('wildcard')) return fail('Wildcards are not supported here');
    if (!WILDCARD_CHARS.test(host) || host.replaceAll('*', '') === '') {
      return fail('Wildcards may only contain letters, digits, dots, hyphens and *');
    }
    return ok({ kind: 'wildcard', source, regex: wildcardToRegExp(host) });
  }

  if (!allowed.includes('domain')) return fail('Plain domains are not supported here');
  const labels = host.split('.');
  if (!labels.every((label) => LABEL.test(label))) return fail(`"${source}" is not a valid domain`);
  return ok({ kind: 'domain', source, domain: host });
}

/** Parses a list of pattern sources, silently skipping invalid ones. */
export function parseSitePatterns(
  sources: readonly string[],
  allowed: readonly PatternKind[] = ALL_KINDS,
): SitePattern[] {
  return sources.flatMap((source) => {
    const result = parseSitePattern(source, allowed);
    return result.ok ? [result.pattern] : [];
  });
}

/** The domains of the plain-domain patterns among `sources`; other kinds are skipped. */
export function domainsOf(sources: readonly string[]): string[] {
  return parseSitePatterns(sources, ['domain']).flatMap((p) =>
    p.kind === 'domain' ? [p.domain] : [],
  );
}

export function matchesHost(pattern: SitePattern, hostname: string): boolean {
  const host = normalizeHost(hostname);
  if (pattern.kind === 'domain') {
    return host === pattern.domain || host.endsWith(`.${pattern.domain}`);
  }
  return pattern.regex.test(host);
}

/**
 * Ranks how specifically a pattern targets a site. Domain patterns always outrank
 * wildcards, which always outrank regular expressions; within a kind, longer wins.
 */
export function specificity(pattern: SitePattern): number {
  switch (pattern.kind) {
    case 'domain':
      return 2_000_000 + pattern.domain.length;
    case 'wildcard':
      return 1_000_000 + pattern.source.replaceAll('*', '').length;
    case 'regex':
      return pattern.source.length;
  }
}

/**
 * Returns the entry whose pattern most specifically matches `hostname`.
 * Ties go to the entry listed first.
 */
export function findBestMatch<T>(
  entries: readonly T[],
  hostname: string,
  patternOf: (entry: T) => SitePattern,
): T | undefined {
  let best: T | undefined;
  let bestScore = -1;
  for (const entry of entries) {
    const pattern = patternOf(entry);
    if (!matchesHost(pattern, hostname)) continue;
    const score = specificity(pattern);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}

/** A content-settings pattern covering a domain and all of its subdomains. */
export function domainContentSettingsPattern(domain: string): string {
  return `*://*.${domain}/*`;
}

/** A content-settings pattern covering exactly one host. */
export function hostContentSettingsPattern(host: string): string {
  return `*://${host}/*`;
}

/** A match pattern (for content scripts) covering a domain and all of its subdomains. */
export function domainMatchPattern(domain: string): string {
  return `*://*.${domain}/*`;
}

/**
 * Translates a wildcard pattern into an RE2-compatible URL filter for
 * declarativeNetRequest. Only valid for patterns of kind 'wildcard'.
 */
export function wildcardToUrlRegexFilter(pattern: SitePattern & { kind: 'wildcard' }): string {
  let host = hostFromInput(pattern.source.toLowerCase());
  if (host.startsWith('*.')) host = host.slice(2);
  const body = host.split('*').map(escapeRegExp).join('[^/?#:]*');
  return `^[a-z][a-z0-9+.-]*://(?:[^/?#:]*\\.)?${body}(?::\\d+)?(?:[/?#]|$)`;
}

export function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, '');
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wildcardToRegExp(host: string): RegExp {
  const body = host.split('*').map(escapeRegExp).join('.*');
  return new RegExp(`^(?:.+\\.)?${body}$`);
}

/** Accepts pasted URLs ("https://www.example.com/path") as well as bare hosts. */
function hostFromInput(input: string): string {
  const withoutScheme = input.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  const host = withoutScheme.split(/[/?#]/, 1)[0] ?? '';
  return host.replace(/:\d+$/, '').replace(/\.$/, '');
}

function ok(pattern: SitePattern): ParseResult {
  return { ok: true, pattern };
}

function fail(error: string): ParseResult {
  return { ok: false, error };
}
