import { describe, expect, it } from 'vitest';
import { compileHttpsRules } from '../src/shared/https';
import { hashPassword, verifyPassword } from '../src/shared/password';
import { defaultSettings } from '../src/shared/settings/schema';
import { compileYouTubeRules } from '../src/shared/site-rules';
import { optionAttribute } from '../src/shared/site-tools';

describe('compileHttpsRules', () => {
  it('adds nothing while HTTPS-only is off', () => {
    expect(compileHttpsRules(defaultSettings().https)).toEqual([]);
  });

  it('upgrades pages and frames except local names, IP addresses and exceptions', () => {
    const rules = compileHttpsRules({ upgrade: true, exceptions: ['legacy.example', '/x/'] });
    expect(rules[0]).toMatchObject({
      action: { type: 'upgradeScheme' },
      condition: { urlFilter: '|http://', resourceTypes: ['main_frame', 'sub_frame'] },
    });
    expect(rules[0]?.condition.excludedRequestDomains).toEqual(
      expect.arrayContaining(['localhost', 'local', 'legacy.example']),
    );
    expect(rules[0]?.condition.excludedRequestDomains).not.toContain('/x/');

    const ipRule = new RegExp(rules[1]?.condition.regexFilter ?? '');
    expect(rules[1]?.action.type).toBe('allow');
    expect(rules[1]?.priority).toBeGreaterThan(rules[0]?.priority ?? 0);
    expect(ipRule.test('http://192.168.1.1/')).toBe(true);
    expect(ipRule.test('http://10.0.0.1:8080')).toBe(true);
    expect(ipRule.test('http://[::1]/')).toBe(true);
    expect(ipRule.test('http://1.2.3.4.example/')).toBe(false);
  });
});

describe('compileYouTubeRules', () => {
  const youtube = { ...defaultSettings().youtube, enabled: true };

  it('adds nothing while the tool is off', () => {
    expect(compileYouTubeRules(defaultSettings().youtube)).toEqual([]);
  });

  it('opens Shorts as videos and embeds without cookies', () => {
    const [shorts, embeds] = compileYouTubeRules(youtube);
    // DNR replaces the part of the URL the pattern matched, like String.replace.
    const redirect = (rule: typeof shorts, url: string) =>
      url.replace(
        new RegExp(rule?.condition.regexFilter ?? ''),
        (rule?.action.redirect?.regexSubstitution ?? '').replace(/\\(\d)/g, '$$$1'),
      );
    expect(redirect(shorts, 'https://www.youtube.com/shorts/abc_D-1?feature=share')).toBe(
      'https://www.youtube.com/watch?v=abc_D-1',
    );
    expect(redirect(embeds, 'https://www.youtube.com/embed/xyz?start=5')).toBe(
      'https://www.youtube-nocookie.com/embed/xyz?start=5',
    );
    expect(embeds?.action.redirect?.regexSubstitution).toContain('youtube-nocookie.com/embed/');
    expect(embeds?.condition.resourceTypes).toEqual(['sub_frame']);
  });

  it('leaves out switched-off options', () => {
    expect(compileYouTubeRules({ ...youtube, hideShorts: false, privacyEmbeds: false })).toEqual(
      [],
    );
  });
});

describe('optionAttribute', () => {
  it('names the attribute after the option', () => {
    expect(optionAttribute('hideShorts')).toBe('data-velo-hide-shorts');
    expect(optionAttribute('revealOnHover')).toBe('data-velo-reveal-on-hover');
  });
});

describe('password hashing', () => {
  it('accepts only the password that was set', async () => {
    const stored = await hashPassword('correct horse');
    expect(stored.hash).not.toContain('correct');
    expect(await verifyPassword('correct horse', stored)).toBe(true);
    expect(await verifyPassword('correct hors', stored)).toBe(false);
  });
});
