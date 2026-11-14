import { getDomain } from 'tldts';
import { hostnameOf } from './domains';

// The public suffix list makes this the largest dependency, so it lives apart from the
// lightweight hostname helpers and only the background script imports it.

/**
 * The registrable domain ("site") of a URL or hostname, e.g. `news.bbc.co.uk` -> `bbc.co.uk`.
 * Hosts without a public suffix (localhost, IP addresses) are returned unchanged.
 */
export function siteOf(urlOrHost: string): string | null {
  const host = hostnameOf(urlOrHost);
  if (host === null) return null;
  return getDomain(host, { allowPrivateDomains: true }) ?? host;
}
