import { findBestMatch, parseSitePattern, type SitePattern } from './patterns';
import type { CookieAction, CookieRule, Settings } from './settings/schema';

export interface CompiledCookieRule {
  readonly rule: CookieRule;
  readonly pattern: SitePattern;
}

export interface CookieDecision {
  readonly action: CookieAction;
  /** The rule that decided, or undefined when the default applied. */
  readonly rule?: CompiledCookieRule;
}

export function compileCookieRules(rules: readonly CookieRule[]): CompiledCookieRule[] {
  return rules.flatMap((rule) => {
    const parsed = parseSitePattern(rule.pattern);
    return parsed.ok ? [{ rule, pattern: parsed.pattern }] : [];
  });
}

/** Decides what happens to cookies for `hostname`: the most specific rule wins. */
export function decideCookieAction(
  hostname: string,
  rules: readonly CompiledCookieRule[],
  defaultAction: CookieAction,
): CookieDecision {
  const match = findBestMatch(rules, hostname, (entry) => entry.pattern);
  return match ? { action: match.rule.action, rule: match } : { action: defaultAction };
}

export function cookieDecisionFor(hostname: string, cookies: Settings['cookies']): CookieDecision {
  return decideCookieAction(hostname, compileCookieRules(cookies.rules), cookies.defaultAction);
}

/** Content-settings value equivalent to an action. `tab` is allowed and cleaned up later. */
export function contentSettingFor(action: CookieAction): 'allow' | 'block' | 'session_only' {
  switch (action) {
    case 'allow':
    case 'tab':
      return 'allow';
    case 'session':
      return 'session_only';
    case 'block':
      return 'block';
  }
}
