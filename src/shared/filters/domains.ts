export interface DomainList {
  include: string[];
  exclude: string[];
  /** Entries that cannot be expressed, such as entity domains (`example.*`) or regexes. */
  skipped: number;
}

/** Parses `a.com|~b.com` (network options) or `a.com,~b.com` (cosmetic filters). */
export function parseDomainList(value: string, separator: '|' | ','): DomainList {
  const list: DomainList = { include: [], exclude: [], skipped: 0 };
  for (const raw of value.split(separator)) {
    const entry = raw.trim();
    if (entry === '') continue;
    const negated = entry.startsWith('~');
    const domain = toAsciiHostname(negated ? entry.slice(1) : entry);
    if (domain === null) list.skipped += 1;
    else (negated ? list.exclude : list.include).push(domain);
  }
  return list;
}

const ASCII_HOSTNAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

/** Lowercases and punycode-encodes a hostname; null if it is not a plain hostname. */
export function toAsciiHostname(input: string): string | null {
  const host = input.toLowerCase();
  if (ASCII_HOSTNAME.test(host)) return host;
  if (/[*/\s:]/.test(host)) return null;
  try {
    const encoded = new URL(`http://${host}`).hostname;
    return ASCII_HOSTNAME.test(encoded) ? encoded : null;
  } catch {
    return null;
  }
}
