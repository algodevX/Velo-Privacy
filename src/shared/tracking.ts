import { ALL_RESOURCE_TYPES, PRIORITY, SUBRESOURCE_TYPES, type RuleSpec } from './dnr';
import { domainsOf, parseSitePatterns, wildcardToUrlRegexFilter } from './patterns';
import type { Settings } from './settings/schema';

/**
 * Query parameters that exist only to identify a click, campaign or recipient.
 * Parameters with any functional use on some site are deliberately left out.
 */
export const TRACKING_PARAMS: readonly string[] = [
  // Google Analytics / Ads
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_name',
  'utm_cid',
  'utm_reader',
  'utm_viz_id',
  'utm_pubreferrer',
  'utm_swu',
  'utm_brand',
  'utm_social',
  'utm_social-type',
  'gclid',
  'gclsrc',
  'dclid',
  'gbraid',
  'wbraid',
  'gad_source',
  'gad_campaignid',
  'srsltid',
  '_ga',
  '_gl',
  // Meta, Microsoft, X, TikTok, LinkedIn, Yandex, Instagram
  'fbclid',
  'msclkid',
  'twclid',
  'ttclid',
  'li_fat_id',
  'yclid',
  'igshid',
  // E-mail and marketing automation
  'mc_cid',
  'mc_eid',
  '_hsenc',
  '_hsmi',
  '__hssc',
  '__hstc',
  '__hsfp',
  'hsCtaTracking',
  'mkt_tok',
  'ml_subscriber',
  'ml_subscriber_hash',
  'oly_anon_id',
  'oly_enc_id',
  'vero_id',
  'vero_conv',
  'wickedid',
  'rb_clickid',
  '_kx',
  'ss_email_id',
  'sc_cid',
  // Affiliate and attribution networks
  'irclickid',
  '_branch_match_id',
  '_branch_referrer',
  'ef_id',
  's_cid',
  '_openstat',
  'epik',
];

/** Compiles tracking-protection settings into declarativeNetRequest rules. */
export function compileTrackingRules(tracking: Settings['tracking']): RuleSpec[] {
  const allowed = domainsOf(tracking.allowedSites);
  const excludeRequests = allowed.length > 0 ? { excludedRequestDomains: allowed } : {};
  const excludeInitiators = allowed.length > 0 ? { excludedInitiatorDomains: allowed } : {};
  const rules: RuleSpec[] = [];

  if (tracking.stripTrackingParams) {
    const params = [...new Set([...TRACKING_PARAMS, ...tracking.extraTrackingParams])];
    rules.push({
      priority: PRIORITY.protection,
      action: {
        type: 'redirect',
        redirect: { transform: { queryTransform: { removeParams: params } } },
      },
      condition: {
        resourceTypes: ['main_frame', 'sub_frame'],
        requestMethods: ['get'],
        ...excludeRequests,
      },
    });
  }

  if (tracking.blockPings) {
    rules.push({
      priority: PRIORITY.protection,
      action: { type: 'block' },
      condition: { resourceTypes: ['ping'], ...excludeInitiators },
    });
  }

  if (tracking.stripThirdPartyReferrer) {
    rules.push({
      priority: PRIORITY.protection,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'referer', operation: 'remove' }],
      },
      condition: {
        domainType: 'thirdParty',
        resourceTypes: [...SUBRESOURCE_TYPES],
        ...excludeInitiators,
      },
    });
  }

  if (tracking.sendGpc) {
    rules.push({
      priority: PRIORITY.protection,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'sec-gpc', operation: 'set', value: '1' }],
      },
      condition: { resourceTypes: [...ALL_RESOURCE_TYPES], ...excludeRequests },
    });
  }

  return rules;
}

/** Compiles the user's blocklist. Domains share one rule; each wildcard needs its own. */
export function compileBlockingRules(blocking: Settings['blocking']): RuleSpec[] {
  const patterns = parseSitePatterns(blocking.blockedSites, ['domain', 'wildcard']);
  const domains = patterns.flatMap((p) => (p.kind === 'domain' ? [p.domain] : []));
  const rules: RuleSpec[] = [];
  if (domains.length > 0) {
    rules.push({
      priority: PRIORITY.protection,
      action: { type: 'block' },
      condition: { requestDomains: domains, resourceTypes: [...ALL_RESOURCE_TYPES] },
    });
  }
  for (const pattern of patterns) {
    if (pattern.kind !== 'wildcard') continue;
    rules.push({
      priority: PRIORITY.protection,
      action: { type: 'block' },
      condition: {
        regexFilter: wildcardToUrlRegexFilter(pattern),
        resourceTypes: [...ALL_RESOURCE_TYPES],
      },
    });
  }
  return rules;
}
