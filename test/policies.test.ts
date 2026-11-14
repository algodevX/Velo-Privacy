import { describe, expect, it } from 'vitest';
import { cookieDecisionFor, contentSettingFor } from '../src/shared/cookie-policy';
import { compileHistoryPolicy, judgeHistoryEntry } from '../src/shared/history-policy';
import { defaultSettings, type Settings } from '../src/shared/settings/schema';
import { compileBlockingRules, compileTrackingRules } from '../src/shared/tracking';

describe('cookie decisions', () => {
  const cookies: Settings['cookies'] = {
    defaultAction: 'tab',
    rules: [
      { pattern: 'google.*', action: 'block' },
      { pattern: 'google.de', action: 'allow' },
      { pattern: 'not a pattern', action: 'allow' },
    ],
  };

  it('falls back to the default', () => {
    expect(cookieDecisionFor('example.org', cookies)).toEqual({ action: 'tab' });
  });

  it('lets a domain rule override a wildcard rule', () => {
    expect(cookieDecisionFor('www.google.de', cookies).action).toBe('allow');
    expect(cookieDecisionFor('www.google.fr', cookies).action).toBe('block');
  });

  it('maps actions onto content settings', () => {
    expect(contentSettingFor('tab')).toBe('allow');
    expect(contentSettingFor('session')).toBe('session_only');
  });
});

describe('history policy', () => {
  const base = defaultSettings().history;

  it('keeps everything by default', () => {
    expect(judgeHistoryEntry(compileHistoryPolicy(base), 'https://example.com/')).toEqual({
      keep: true,
    });
  });

  it('excludes sites and keywords in the URL or title, ignoring case and encoding', () => {
    const policy = compileHistoryPolicy({
      ...base,
      excludedSites: ['bank.example'],
      excludedKeywords: ['Online Banking'],
    });
    expect(judgeHistoryEntry(policy, 'https://login.bank.example/')).toEqual({
      keep: false,
      reason: 'site',
    });
    expect(judgeHistoryEntry(policy, 'https://news.example/online%20banking')).toMatchObject({
      reason: 'keyword',
    });
    expect(judgeHistoryEntry(policy, 'https://a.example/', 'ONLINE BANKING tips')).toMatchObject({
      reason: 'keyword',
    });
  });

  it('reports exclusions ahead of the pause switch', () => {
    const policy = compileHistoryPolicy({ ...base, record: false, excludedSites: ['x.example'] });
    expect(judgeHistoryEntry(policy, 'https://x.example/')).toMatchObject({ reason: 'site' });
    expect(judgeHistoryEntry(policy, 'https://y.example/')).toMatchObject({ reason: 'paused' });
  });
});

describe('tracking rules', () => {
  const tracking = defaultSettings().tracking;

  it('strips parameters, blocks pings and sends GPC by default', () => {
    const rules = compileTrackingRules(tracking);
    const strip = rules.find((r) => r.action.type === 'redirect');
    expect(strip?.action.redirect?.transform?.queryTransform?.removeParams).toContain('fbclid');
    expect(rules.some((r) => r.condition.resourceTypes?.includes('ping'))).toBe(true);
    expect(rules.some((r) => r.action.requestHeaders?.[0]?.header === 'sec-gpc')).toBe(true);
  });

  it('exempts allowed sites and adds extra parameters', () => {
    const rules = compileTrackingRules({
      ...tracking,
      allowedSites: ['shop.example', 'bad pattern *'],
      extraTrackingParams: ['ref_src'],
    });
    const strip = rules.find((r) => r.action.type === 'redirect');
    expect(strip?.condition.excludedRequestDomains).toEqual(['shop.example']);
    expect(strip?.action.redirect?.transform?.queryTransform?.removeParams).toContain('ref_src');
  });

  it('emits nothing when everything is off', () => {
    expect(
      compileTrackingRules({
        ...tracking,
        stripTrackingParams: false,
        blockPings: false,
        stripThirdPartyReferrer: false,
        sendGpc: false,
      }),
    ).toEqual([]);
  });
});

describe('blocking rules', () => {
  it('groups domains into one rule and gives each wildcard its own', () => {
    const rules = compileBlockingRules({ blockedSites: ['a.example', 'b.example', 'ads.*'] });
    expect(rules).toHaveLength(2);
    expect(rules[0]?.condition.requestDomains).toEqual(['a.example', 'b.example']);
    expect(rules[1]?.condition.regexFilter).toBeDefined();
  });
});
