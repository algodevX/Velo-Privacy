import { parseDomainList } from './domains';

export type CosmeticFilter =
  | {
      readonly kind: 'hide';
      readonly exception: boolean;
      readonly include: readonly string[];
      readonly exclude: readonly string[];
      readonly selector: string;
    }
  | { readonly kind: 'unsupported'; readonly reason: string };

const SEPARATOR = /^([^/|@"!]*?)(#@?(?:\?|\$\??|%)?#)(.*)$/;

/**
 * Extended selectors that browsers cannot evaluate in a stylesheet. `:has()` is native CSS
 * and is deliberately absent.
 */
const PROCEDURAL = new RegExp(
  ':(?:-abp-[a-z-]+|has-text|contains|upward|remove|remove-attr|remove-class|style|' +
    'matches-[a-z]+|min-text-length|others|watch-attr|xpath|if|if-not|nth-ancestor|spath|shadow)\\(',
);

/** Parses an element-hiding filter; returns null when the line is not a cosmetic filter. */
export function parseCosmeticFilter(line: string): CosmeticFilter | null {
  const match = SEPARATOR.exec(line);
  if (match === null) return null;
  const [, domains = '', separator = '', selector = ''] = match;

  if (separator !== '##' && separator !== '#@#') {
    return unsupported(
      separator.includes('%') || separator.includes('$') ? 'script injection' : 'procedural filter',
    );
  }
  if (selector.startsWith('+js(')) return unsupported('scriptlet');
  if (selector.startsWith('^')) return unsupported('HTML filter');
  if (selector === '' || /[{}]/.test(selector) || selector.includes('</'))
    return unsupported('invalid selector');
  if (PROCEDURAL.test(selector)) return unsupported('procedural filter');

  const list = parseDomainList(domains, ',');
  if (list.include.length === 0 && list.skipped > 0) return unsupported('entity domain');
  return {
    kind: 'hide',
    exception: separator === '#@#',
    include: list.include,
    exclude: list.exclude,
    selector: selector.trim(),
  };
}

function unsupported(reason: string): CosmeticFilter {
  return { kind: 'unsupported', reason };
}
