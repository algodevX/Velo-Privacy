import { ALL_RESOURCE_TYPES, PRIORITY, type QueryKeyValue, type RuleSpec } from '../dnr';
import { escapeRegExp } from '../patterns';
import type { Settings } from '../settings/schema';
import { enabledEngines, resolvePreferences, type SearchEngine } from './engines';

/** Consent cookie header per host, e.g. `www.google.de` -> `SOCS=...; CONSENT=...`. */
export type ConsentCookieHeaders = ReadonlyMap<string, string>;

const PRIORITY_DEFAULT = PRIORITY.protection;
/**
 * Hosts are matched with `requestDomains` and only paths with a regular expression:
 * Chromium caps each compiled regex at 2 KB, which an alternation of every Google
 * domain would exceed.
 */
const ANY_HOST = '^https://[^/?#]+';
const PRIORITY_OVERRIDE = PRIORITY.protectionOverride;

/**
 * Compiles search settings into declarativeNetRequest rules:
 *
 * 1. Preferences: results pages are redirected once with the region, language and SafeSearch
 *    parameters added. Rewriting an already-rewritten URL yields the same URL, which DNR
 *    treats as a no-op, so there is no redirect loop.
 * 2. Isolation: search requests are sent without cookies and responses cannot set any.
 *    If the user answered a consent banner, only that answer is replayed.
 */
export function compileSearchRules(
  search: Settings['search'],
  consent: ConsentCookieHeaders = new Map(),
): RuleSpec[] {
  const prefs = resolvePreferences(search);
  return enabledEngines(search).flatMap((engine) => [
    ...preferenceRules(engine, engine.params(prefs), search.webResultsOnly),
    ...(search.isolate ? isolationRules(engine, search.preserveConsent ? consent : new Map()) : []),
  ]);
}

function preferenceRules(
  engine: SearchEngine,
  params: Record<string, string>,
  webResultsOnly: boolean,
): RuleSpec[] {
  const base = toQueryParams(params);
  const webParam = webResultsOnly ? engine.webResultsParam : undefined;
  const paths = alternation(engine.resultPaths);
  const resultsUrl = `${ANY_HOST}(?:${paths})[^#]*[?&]${escapeRegExp(engine.queryParam)}=`;

  const rules: RuleSpec[] = [];
  if (base.length > 0 || webParam) {
    const added = webParam ? [...base, webParam] : base;
    rules.push(redirectRule(PRIORITY_DEFAULT, engine, resultsUrl, added));
  }
  // When the user picked a specific view (images, news...) the view parameter is already
  // present; this higher-priority rule applies the preferences without forcing the plain
  // web view on top. Only one redirect rule applies per request, so the two never stack.
  // (An `allow` rule would be the obvious alternative, but it would also switch off the
  // isolation rules below for that request.)
  if (webParam && base.length > 0) {
    const viewUrl = `${ANY_HOST}(?:${paths})[^#]*[?&]${escapeRegExp(webParam.key)}=`;
    rules.push(redirectRule(PRIORITY_OVERRIDE, engine, viewUrl, base));
  }
  return rules;
}

function isolationRules(engine: SearchEngine, consent: ConsentCookieHeaders): RuleSpec[] {
  const rules: RuleSpec[] = [
    {
      priority: PRIORITY_DEFAULT,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'cookie', operation: 'remove' }],
        responseHeaders: [{ header: 'set-cookie', operation: 'remove' }],
      },
      condition: isolationCondition(engine, engine.hosts),
    },
  ];
  for (const host of engine.hosts) {
    const cookieHeader = consent.get(host);
    if (cookieHeader === undefined) continue;
    rules.push({
      priority: PRIORITY_OVERRIDE,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'cookie', operation: 'set', value: cookieHeader }],
        responseHeaders: [{ header: 'set-cookie', operation: 'remove' }],
      },
      condition: isolationCondition(engine, [host]),
    });
  }
  return rules;
}

function isolationCondition(engine: SearchEngine, hosts: readonly string[]): RuleSpec['condition'] {
  if (engine.dedicatedHosts) {
    return { requestDomains: [...hosts], resourceTypes: [...ALL_RESOURCE_TYPES] };
  }
  return {
    requestDomains: [...hosts],
    regexFilter: `${ANY_HOST}(?:${alternation(engine.isolatedPaths)})(?:[/?#]|$)`,
    resourceTypes: [...ALL_RESOURCE_TYPES],
  };
}

function redirectRule(
  priority: number,
  engine: SearchEngine,
  regexFilter: string,
  params: QueryKeyValue[],
): RuleSpec {
  return {
    priority,
    action: {
      type: 'redirect',
      redirect: { transform: { queryTransform: { addOrReplaceParams: params } } },
    },
    // GET only: redirecting a POST (Startpage's on-page form) would drop the query.
    condition: {
      requestDomains: [...engine.hosts],
      regexFilter,
      resourceTypes: ['main_frame'],
      requestMethods: ['get'],
    },
  };
}

function toQueryParams(params: Record<string, string>): QueryKeyValue[] {
  return Object.entries(params).map(([key, value]) => ({ key, value }));
}

function alternation(values: readonly string[]): string {
  return values.map(escapeRegExp).join('|');
}
