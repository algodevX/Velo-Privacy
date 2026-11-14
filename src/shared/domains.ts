/**
 * The registrable domain ("site a bare host. Returns null for non-web URLs. */
export function hostnameOf(urlOrHost: string): string | null {
  if (!urlOrHost.includes('://')) return urlOrHost.toLowerCase() || null;
  try {
    const url = new URL(urlOrHost);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}
