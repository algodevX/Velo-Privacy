import { describe, expect, it } from 'vitest';
import { PRIORITY } from '../src/shared/dnr';
import { compileFilterList } from '../src/shared/filters/compile';
import { parseCosmeticFilter } from '../src/shared/filters/cosmetic';
import { convertNetworkFilter } from '../src/shared/filters/network';
import { evaluate, filterEnvironment, preprocess } from '../src/shared/filters/preprocess';

function rule(filter: string) {
  const result = convertNetworkFilter(filter);
  if (result.kind !== 'rule') throw new Error(`expected a rule, got ${JSON.stringify(result)}`);
  return result;
}

function reason(filter: string) {
  const result = convertNetworkFilter(filter);
  return result.kind === 'unsupported' ? result.reason : undefined;
}

describe('network filters', () => {
  it('keeps Adblock Plus patterns as DNR url filters', () => {
    expect(rule('||ads.example.com/banner^').rule).toEqual({
      priority: PRIORITY.filterBlock,
      action: { type: 'block' },
      condition: { urlFilter: '||ads.example.com/banner^' },
    });
    expect(rule('/ad-frame/*').rule.condition.urlFilter).toBe('/ad-frame/');
  });

  it('marks exact host filters for grouping, including bare hostnames', () => {
    expect(rule('||tracker.example^').host).toBe('tracker.example');
    expect(rule('tracker.example').host).toBe('tracker.example');
    expect(rule('||tracker.example').host).toBeUndefined();
  });

  it('maps types, party and domain options', () => {
    const { condition } = rule('||cdn.example^$script,xhr,third-party,domain=a.com|~b.a.com').rule;
    expect(condition).toMatchObject({
      resourceTypes: ['script', 'xmlhttprequest'],
      domainType: 'thirdParty',
      initiatorDomains: ['a.com'],
      excludedInitiatorDomains: ['b.a.com'],
    });
  });

  it('never lets negated types block whole pages', () => {
    const types = rule('||example.com^$~script').rule.condition.resourceTypes ?? [];
    expect(types).not.toContain('main_frame');
    expect(types).not.toContain('script');
    expect(types).toContain('image');
  });

  it('turns exceptions into allow rules and $document exceptions into allowAllRequests', () => {
    expect(rule('@@||example.com/ads.js').rule.action.type).toBe('allow');
    const page = rule('@@||example.com^$document').rule;
    expect(page.action.type).toBe('allowAllRequests');
    expect(page.condition.resourceTypes).toEqual(['main_frame', 'sub_frame']);
  });

  it('ranks important filters above exceptions', () => {
    expect(rule('||x.example^$important').rule.priority).toBeGreaterThan(PRIORITY.filterException);
  });

  it('converts literal removeparam filters', () => {
    expect(rule('$removeparam=utm_source').rule.action).toEqual({
      type: 'redirect',
      redirect: { transform: { queryTransform: { removeParams: ['utm_source'] } } },
    });
  });

  it('accepts portable regexes and rejects lookarounds', () => {
    expect(rule('/^https:\\/\\/ad\\d+\\./').rule.condition.regexFilter).toBe(
      '^https:\\/\\/ad\\d+\\.',
    );
    expect(reason('/ad(?!min)/')).toBe('regex syntax');
  });

  it('rejects filters it cannot express exactly', () => {
    expect(reason('||example.com^$popup')).toBe('$popup');
    expect(reason('||example.com^$redirect=noopjs')).toBe('$redirect');
    expect(reason('||example.com^$domain=example.*')).toBe('entity domain');
    expect(reason('||exämple.com^')).toBe('non-ASCII pattern');
  });

  it('recognises cosmetic exceptions', () => {
    expect(convertNetworkFilter('@@||news.example^$generichide')).toEqual({
      kind: 'cosmetic-exception',
      scope: 'generic',
      hosts: ['news.example'],
    });
  });

  it('only treats a trailing $ as options when they parse as options', () => {
    expect(rule('||example.com/a$b/c').rule.condition.urlFilter).toBe('||example.com/a$b/c');
    expect(reason('||example.com^$unknown-option')).toBe('$unknown-option');
  });
});

describe('cosmetic filters', () => {
  it('parses generic, specific and exception filters', () => {
    expect(parseCosmeticFilter('##.ad-banner')).toMatchObject({
      include: [],
      selector: '.ad-banner',
    });
    expect(parseCosmeticFilter('a.com,~b.a.com##div:has(> .sponsored)')).toMatchObject({
      exception: false,
      include: ['a.com'],
      exclude: ['b.a.com'],
    });
    expect(parseCosmeticFilter('a.com#@#.ad')).toMatchObject({ exception: true });
  });

  it('rejects what a stylesheet cannot do', () => {
    expect(parseCosmeticFilter('a.com##+js(set, x, 1)')).toEqual({
      kind: 'unsupported',
      reason: 'scriptlet',
    });
    expect(parseCosmeticFilter('a.com##div:has-text(Sponsored)')).toMatchObject({
      reason: 'procedural filter',
    });
    expect(parseCosmeticFilter('a.com#?#div')).toMatchObject({ reason: 'procedural filter' });
    expect(parseCosmeticFilter('a.com##body { color: red }')).toMatchObject({
      reason: 'invalid selector',
    });
  });

  it('ignores network filters', () => {
    expect(parseCosmeticFilter('||example.com/#ad')).toBeNull();
  });
});

describe('compileFilterList', () => {
  const list = [
    '[Adblock Plus 2.0]',
    '! Title: Test',
    '||a.example^',
    '||b.example^',
    '||c.example^$third-party',
    '||cancelled.example^',
    '||cancelled.example^$badfilter',
    '/banner/*$image',
    '/banner/*$image',
    '##.ad',
    '##.keep-me',
    '#@#.keep-me',
    'news.example##.sidebar-ad',
    'news.example#@#.ad',
    '@@||shop.example^$generichide',
    'example.com##+js(nowebrtc)',
  ];
  const result = compileFilterList(list, { keepRejected: 10 });

  it('groups host filters with identical options into one rule', () => {
    const hostRules = result.rules.filter((r) => r.condition.requestDomains);
    expect(hostRules).toHaveLength(2);
    expect(hostRules[0]?.condition.requestDomains).toEqual(['a.example', 'b.example']);
    expect(hostRules[1]?.condition).toMatchObject({
      requestDomains: ['c.example'],
      domainType: 'thirdParty',
    });
  });

  it('applies $badfilter and removes duplicates', () => {
    expect(JSON.stringify(result.rules)).not.toContain('cancelled');
    expect(result.rules.filter((r) => r.condition.urlFilter === '/banner/')).toHaveLength(1);
  });

  it('collects element hiding data', () => {
    expect(result.cosmetic.generic).toEqual(['.ad']);
    expect(result.cosmetic.specific).toEqual({ 'news.example': ['.sidebar-ad'] });
    expect(result.cosmetic.exceptions).toEqual({ 'news.example': ['.ad'] });
    expect(result.cosmetic.genericHide).toEqual(['shop.example']);
  });

  it('reports rejected filters with line numbers', () => {
    expect(result.rejected).toEqual([
      { line: 16, text: 'example.com##+js(nowebrtc)', reason: 'scriptlet' },
    ]);
  });

  it('keeps only regex filters the browser accepts, up to the limit', () => {
    const lines = ['/a\\d/', '/b\\d/', '/c{2000}/'];
    const accepted = compileFilterList(lines, {
      isRegexSupported: (regex) => !regex.includes('{2000}'),
      maxRegexRules: 1,
    });
    expect(accepted.stats.regexRules).toBe(1);
    expect(accepted.stats.unsupported).toEqual({
      'regex rule limit': 1,
      'regular expression not supported by the browser': 1,
    });
    expect(compileFilterList(lines).stats.regexRules).toBe(0);
  });
});

describe('preprocessor', () => {
  const env = filterEnvironment('firefox');

  it('evaluates directive expressions', () => {
    expect(evaluate('env_firefox && !env_chromium', env)).toBe(true);
    expect(evaluate('(env_safari || env_chromium) && env_mv3', env)).toBe(false);
    expect(evaluate('cap_html_filtering', env)).toBe(false);
  });

  it('keeps only the active branches, including nested ones', () => {
    const text = [
      'a',
      '!#if env_firefox',
      'b',
      '!#if env_safari',
      'c',
      '!#else',
      'd',
      '!#endif',
      '!#else',
      'e',
      '!#endif',
      'f',
    ];
    expect(preprocess(text.join('\n'), env)).toEqual(['a', 'b', 'd', 'f']);
  });
});
