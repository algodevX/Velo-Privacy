import type { BrowserTarget } from '../target';

/**
 * Tokens that are true when evaluating `!#if` directives. Names follow uBlock Origin's
 * conventions so its lists work unchanged; anything not listed here is false.
 */
export function filterEnvironment(target: BrowserTarget): ReadonlySet<string> {
  const browser = { chromium: 'env_chromium', firefox: 'env_firefox', safari: 'env_safari' }[
    target
  ];
  return new Set(['env_mv3', 'cap_user_stylesheet', browser]);
}

/**
 * Applies `!#if` / `!#else` / `!#endif` directives and returns the lines that remain.
 * `!#include` lines are kept for the caller to resolve, since that needs network access.
 */
export function preprocess(text: string, env: ReadonlySet<string>): string[] {
  const kept: string[] = [];
  // One entry per open `!#if`: whether its current branch is active.
  const stack: { active: boolean; parentActive: boolean }[] = [];
  const active = () => stack.every((frame) => frame.active);

  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('!#if ')) {
      const parentActive = active();
      stack.push({ active: parentActive && evaluate(line.slice(5), env), parentActive });
    } else if (line.startsWith('!#else')) {
      const frame = stack.at(-1);
      if (frame) frame.active = frame.parentActive && !frame.active;
    } else if (line.startsWith('!#endif')) {
      stack.pop();
    } else if (active()) {
      kept.push(line);
    }
  }
  return kept;
}

/** Evaluates a directive expression: identifiers, `!`, `&&`, `||` and parentheses. */
export function evaluate(expression: string, env: ReadonlySet<string>): boolean {
  const tokens = expression.match(/[A-Za-z0-9_]+|&&|\|\||[!()]/g) ?? [];
  let position = 0;

  const or = (): boolean => {
    let value = and();
    while (tokens[position] === '||') {
      position += 1;
      value = and() || value;
    }
    return value;
  };
  const and = (): boolean => {
    let value = unary();
    while (tokens[position] === '&&') {
      position += 1;
      value = unary() && value;
    }
    return value;
  };
  const unary = (): boolean => {
    const token = tokens[position++];
    if (token === '!') return !unary();
    if (token === '(') {
      const value = or();
      position += 1; // ')'
      return value;
    }
    return token !== undefined && env.has(token);
  };

  return or();
}
