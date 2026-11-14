import { describe, expect, it } from 'vitest';
import type { RuleSpec } from '../src/shared/dnr';
import { SEARCH_ENGINES, resolvePreferences } from '../src/shared/search/engines';
import { compileSearchRules } from '../src/shared/search/rules';
import { defaultSettings, type Settings } from '../src/shared/settings/schema';

function searchSettings(overrides: Partial<Settings['search']>): Settings['search'] {
  return { ...defaultSettings().search, ...overrides };
}

function engine(id: string) {
  const found = SEARCH_ENGINES.find((e) => e.id === id);
  if (!found) throw new Error(`unknown engine ${id}`);
  return found;
}

/** Mirrors how declarativeNetRequest matches the conditions these rules use. */
function matches(rule: RuleSpec, url: string): boolean {
  const host = new URL(url).hostname;
  const { requestDomains, regexFilter } = rule.condition;
  const domainOk =
    requestDomains === undefined ||
    requestDomains.some((d) => host === d || host.endsWith(`.${d}`));
  return domainOk && (regexFilter === undefined || new RegExp(regexFilter).test(url));
}

function redirectsFor(rules: RuleSpec[], url: string) {
  return rules
    .filter((rule) => rule.action.type === 'redirect' && matches(rule, url))
    .sort((a, b) => b.priority - a.priority);
}

function addedParams(rule: RuleSpec | undefined): Record<string, string> {
  const params = rule?.action.redirect?.transform?.queryTransform?.addOrReplaceParams ?? [];
  return Object.fromEntries(params.map(({ key, value }) => [key, value]));
}

describe('search preferences', () => {
  const germanyNoFilter = searchSettings({ region: 'de', safeSearch: 'off', isolate: false });
  const prefs = resolvePreferences(germanyNoFilter);

  it('derives the language from the region', () => {
    expect(prefs.language?.id).toBe('de');
  });

  it('maps preferences onto each engine', () => {
    expect(engine('google').params(prefs)).toEqual({ pws: '0', gl: 'de', hl: 'de', safe: 'off' });
    expect(engine('duckduckgo').params(prefs)).toEqual({ kl: 'de-de', kp: '-2' });
    expect(engine('startpage').params(prefs)).toEqual({
      language: 'deutsch',
      lui: 'deutsch',
      qadf: 'none',
    });
    expect(engine('bing').params(prefs)).toEqual({ cc: 'DE', setlang: 'de', adlt: 'off' });
  });

  it('applies them to results pages with a query, and nowhere else', () => {
    const rules = compileSearchRules(germanyNoFilter);
    expect(
      addedParams(redirectsFor(rules, 'https://www.startpage.com/sp/search?query=x')[0]),
    ).toEqual({
      language: 'deutsch',
      lui: 'deutsch',
      qadf: 'none',
    });
    expect(redirectsFor(rules, 'https://www.startpage.com/')).toHaveLength(0);
    expect(redirectsFor(rules, 'https://www.google.com/maps?q=berlin')).toHaveLength(0);
    expect(redirectsFor(rules, 'https://www.google.de/search?q=x')).toHaveLength(1);
  });

  it('keeps every regular expression well under the 2 KB compiled limit', () => {
    const rules = compileSearchRules(searchSettings({ region: 'de', webResultsOnly: true }));
    for (const rule of rules) expect(rule.condition.regexFilter?.length ?? 0).toBeLessThan(200);
  });

  it('only redirects GET navigations, so POST searches keep their query', () => {
    for (const rule of compileSearchRules(germanyNoFilter)) {
      if (rule.action.type === 'redirect') expect(rule.condition.requestMethods).toEqual(['get']);
    }
  });

  it('forces the plain web view only when no other view was chosen', () => {
    const rules = compileSearchRules(searchSettings({ webResultsOnly: true, isolate: false }));
    const web = redirectsFor(rules, 'https://www.google.com/search?q=x')[0];
    const images = redirectsFor(rules, 'https://www.google.com/search?q=x&udm=2')[0];
    expect(addedParams(web)).toMatchObject({ udm: '14' });
    expect(addedParams(images)).not.toHaveProperty('udm');
  });

  it('skips disabled engines', () => {
    const rules = compileSearchRules(
      searchSettings({ region: 'de', isolate: false, disabledEngines: ['google'] }),
    );
    expect(redirectsFor(rules, 'https://www.google.com/search?q=x')).toHaveLength(0);
  });
});

describe('search isolation', () => {
  const isolationRules = (rules: RuleSpec[]) =>
    rules.filter((r) => r.action.type === 'modifyHeaders');

  it('strips cookies on dedicated hosts and on search paths of shared hosts', () => {
    const rules = isolationRules(compileSearchRules(searchSettings({ isolate: true })));
    const google = rules.find((r) => r.condition.requestDomains?.includes('www.google.com'));
    if (google === undefined) throw new Error('missing Google isolation rule');
    expect(matches(google, 'https://www.google.com/search?q=x')).toBe(true);
    expect(matches(google, 'https://www.google.de/complete/search?q=x')).toBe(true);
    expect(matches(google, 'https://www.google.com/maps')).toBe(false);
    expect(matches(google, 'https://www.google.com/searchengines')).toBe(false);
    expect(matches(google, 'https://mail.google.com/search')).toBe(false);
    expect(rules.some((r) => r.condition.requestDomains?.includes('duckduckgo.com'))).toBe(true);
  });

  it('replays consent cookies with a higher priority than the removal', () => {
    const consent = new Map([['www.google.de', 'SOCS=abc']]);
    const rules = isolationRules(compileSearchRules(searchSettings({ isolate: true }), consent));
    const replay = rules.find((r) => r.action.requestHeaders?.[0]?.operation === 'set');
    expect(replay?.action.requestHeaders?.[0]).toEqual({
      header: 'cookie',
      operation: 'set',
      value: 'SOCS=abc',
    });
    expect(replay?.priority).toBeGreaterThan(1);
  });

  it('does not replay consent when the user opted out', () => {
    const consent = new Map([['www.google.de', 'SOCS=abc']]);
    const rules = compileSearchRules(
      searchSettings({ isolate: true, preserveConsent: false }),
      consent,
    );
    expect(rules.some((r) => r.action.requestHeaders?.[0]?.operation === 'set')).toBe(false);
  });
});
