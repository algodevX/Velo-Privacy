/**
 * Structural types for declarativeNetRequest rules.
 *
 * `@types/chrome` models DNR values as runtime enums, which do not exist outside the
 * browser. Rule compilers produce these plain-string equivalents so they stay pure and
 * unit-testable; the background converts them at the API boundary.
 */

export type ResourceType =
  | 'main_frame'
  | 'sub_frame'
  | 'stylesheet'
  | 'script'
  | 'image'
  | 'font'
  | 'object'
  | 'xmlhttprequest'
  | 'ping'
  | 'csp_report'
  | 'media'
  | 'websocket'
  | 'webtransport'
  | 'webbundle'
  | 'other';

export const ALL_RESOURCE_TYPES: readonly ResourceType[] = [
  'main_frame',
  'sub_frame',
  'stylesheet',
  'script',
  'image',
  'font',
  'object',
  'xmlhttprequest',
  'ping',
  'csp_report',
  'media',
  'websocket',
  'webtransport',
  'webbundle',
  'other',
];

export const SUBRESOURCE_TYPES: readonly ResourceType[] = ALL_RESOURCE_TYPES.filter(
  (type) => type !== 'main_frame' && type !== 'sub_frame',
);

export interface QueryKeyValue {
  key: string;
  value: string;
  replaceOnly?: boolean;
}

export interface HeaderInfo {
  header: string;
  operation: 'append' | 'set' | 'remove';
  value?: string;
}

export interface RuleAction {
  type: 'block' | 'redirect' | 'allow' | 'upgradeScheme' | 'modifyHeaders' | 'allowAllRequests';
  redirect?: {
    regexSubstitution?: string;
    transform?: {
      queryTransform?: { removeParams?: string[]; addOrReplaceParams?: QueryKeyValue[] };
    };
  };
  requestHeaders?: HeaderInfo[];
  responseHeaders?: HeaderInfo[];
}

export interface RuleCondition {
  regexFilter?: string;
  urlFilter?: string;
  isUrlFilterCaseSensitive?: boolean;
  requestDomains?: string[];
  excludedRequestDomains?: string[];
  initiatorDomains?: string[];
  excludedInitiatorDomains?: string[];
  domainType?: 'firstParty' | 'thirdParty';
  resourceTypes?: ResourceType[];
  excludedResourceTypes?: ResourceType[];
  requestMethods?: (
    'get' | 'post' | 'head' | 'put' | 'delete' | 'patch' | 'options' | 'connect' | 'other'
  )[];
}

/**
 * Rule priorities across all of Velo's rules.
 *
 * Filter lists sit at the bottom. A per-site "allow all requests" for ad blocking sits
 * above them but below every other protection, so turning ad blocking off for a site
 * cannot switch off search isolation or tracking protection there.
 */
export const PRIORITY = {
  filterBlock: 10,
  filterException: 20,
  filterImportant: 30,
  adblockSiteException: 100,
  protection: 1_000,
  protectionOverride: 1_001,
} as const;

export interface Rule extends RuleSpec {
  id: number;
}

/** A rule without an id; ids are assigned when rules are installed. */
export interface RuleSpec {
  priority: number;
  action: RuleAction;
  condition: RuleCondition;
}

/**
 * Each background module owns a fixed range of dynamic rule ids, so modules can replace
 * their own rules without knowing about each other's.
 */
export const RULE_ID_RANGES = {
  search: { first: 1, last: 999 },
  tracking: { first: 1_000, last: 1_999 },
  blocking: { first: 2_000, last: 9_999 },
  // Firefox allows 5,000 dynamic rules in total, which bounds the user's own filters.
  adblock: { first: 10_000, last: 14_999 },
  https: { first: 15_000, last: 15_009 },
  sites: { first: 15_010, last: 15_099 },
} as const;
