import { PRIORITY, type RuleSpec } from './dnr';
import { domainsOf } from './patterns';
import type { Settings } from './settings/schema';

/**
 * Names that only resolve on local networks, where certificates are rare. Each also covers
 * its subdomains, so `local` covers every `*.local` printer and router.
 */
export const LOCAL_DOMAINS: readonly string[] = [
  'localhost',
  'local',
  'lan',
  'home',
  'home.arpa',
  'internal',
  'intranet',
  'corp',
  'test',
  'onion',
];

// Addresses typed as numbers (`http://192.168.1.1/`, `http://[::1]/`) are mostly devices on
// the local network. Matched by shape, as DNR has no notion of address ranges.
const IP_ADDRESS_URL = String.raw`^http://(\[|\d+\.\d+\.\d+\.\d+([:/?#]|$))`;

/**
 * Rules that load pages and frames over HTTPS instead of HTTP.
 *
 * Unlike the browsers' own HTTPS-First modes, a declarative rule cannot fall back to HTTP
 * when a site has no HTTPS version; such sites fail to load until added as exceptions.
 */
export function compileHttpsRules(https: Settings['https']): RuleSpec[] {
  if (!https.upgrade) return [];
  return [
    {
      priority: PRIORITY.protection,
      action: { type: 'upgradeScheme' },
      condition: {
        urlFilter: '|http://',
        resourceTypes: ['main_frame', 'sub_frame'],
        excludedRequestDomains: [...LOCAL_DOMAINS, ...domainsOf(https.exceptions)],
      },
    },
    {
      priority: PRIORITY.protectionOverride,
      action: { type: 'allow' },
      condition: { regexFilter: IP_ADDRESS_URL, resourceTypes: ['main_frame', 'sub_frame'] },
    },
  ];
}
