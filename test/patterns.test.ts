import { describe, expect, it } from 'vitest';
import {
  findBestMatch,
  matchesHost,
  parseSitePattern,
  wildcardToUrlRegexFilter,
  type SitePattern,
} from '../src/shared/patterns';

function parse(input: string): SitePattern {
  const result = parseSitePattern(input);
  if (!result.ok) throw new Error(result.error);
  return result.pattern;
}

describe('parseSitePattern', () => {
  it('parses plain domains, treating *. as the same thing', () => {
    expect(parse('Example.COM')).toMatchObject({ kind: 'domain', domain: 'example.com' });
    expect(parse('*.example.com')).toMatchObject({ kind: 'domain', domain: 'example.com' });
  });

  it('reduces pasted URLs to their host', () => {
    expect(parse('https://www.example.com:8443/a?b#c')).toMatchObject({
      kind: 'domain',
      domain: 'www.example.com',
    });
  });

  it('recognises wildcards and regular expressions', () => {
    expect(parse('google.*').kind).toBe('wildcard');
    expect(parse('/^ads?\\d*\\./').kind).toBe('regex');
  });

  it('rejects invalid input with a readable message', () => {
    expect(parseSitePattern('')).toMatchObject({ ok: false });
    expect(parseSitePattern('exa mple.com')).toMatchObject({ ok: false });
    expect(parseSitePattern('-bad-.com')).toMatchObject({ ok: false });
    expect(parseSitePattern('/(unclosed/')).toMatchObject({ ok: false });
    expect(parseSitePattern('*')).toMatchObject({ ok: false });
  });

  it('honours the allowed kinds', () => {
    expect(parseSitePattern('google.*', ['domain'])).toEqual({
      ok: false,
      error: 'Wildcards are not supported here',
    });
    expect(parseSitePattern('/x/', ['domain', 'wildcard'])).toMatchObject({ ok: false });
  });
});

describe('matchesHost', () => {
  it('matches a domain and its subdomains only', () => {
    const pattern = parse('example.com');
    expect(matchesHost(pattern, 'example.com')).toBe(true);
    expect(matchesHost(pattern, 'a.b.example.com')).toBe(true);
    expect(matchesHost(pattern, 'notexample.com')).toBe(false);
    expect(matchesHost(pattern, 'example.com.evil.net')).toBe(false);
  });

  it('lets * span dots and also covers subdomains', () => {
    const pattern = parse('google.*');
    expect(matchesHost(pattern, 'google.de')).toBe(true);
    expect(matchesHost(pattern, 'www.google.co.uk')).toBe(true);
    expect(matchesHost(pattern, 'notgoogle.de')).toBe(false);
  });

  it('tests regular expressions case-insensitively against the host', () => {
    const pattern = parse('/^ads\\d+\\./');
    expect(matchesHost(pattern, 'ADS42.example.com')).toBe(true);
    expect(matchesHost(pattern, 'www.ads42.example.com')).toBe(false);
  });

  it('ignores a trailing dot', () => {
    expect(matchesHost(parse('example.com'), 'example.com.')).toBe(true);
  });
});

describe('findBestMatch', () => {
  const entries = ['/example/', 'example.*', 'example.com', 'mail.example.com'].map((source) => ({
    source,
    pattern: parse(source),
  }));
  const best = (host: string) => findBestMatch(entries, host, (e) => e.pattern)?.source;

  it('prefers the most specific pattern', () => {
    expect(best('mail.example.com')).toBe('mail.example.com');
    expect(best('www.example.com')).toBe('example.com');
    expect(best('example.org')).toBe('example.*');
    expect(best('myexample.net')).toBe('/example/');
    expect(best('unrelated.net')).toBeUndefined();
  });
});

describe('wildcardToUrlRegexFilter', () => {
  it('builds a URL filter equivalent to the host match', () => {
    const pattern = parse('ads.*.example');
    if (pattern.kind !== 'wildcard') throw new Error('expected a wildcard');
    const regex = new RegExp(wildcardToUrlRegexFilter(pattern));
    expect(regex.test('https://ads.eu.example/pixel.gif')).toBe(true);
    expect(regex.test('https://cdn.ads.eu.example:8080')).toBe(true);
    expect(regex.test('https://example.com/?u=ads.eu.example')).toBe(false);
  });
});
