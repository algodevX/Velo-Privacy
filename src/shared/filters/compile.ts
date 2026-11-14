import type { RuleSpec } from '../dnr';
import { parseCosmeticFilter } from './cosmetic';
import { convertNetworkFilter, splitOptions } from './network';

/** Element-hiding data, keyed by hostname; entries apply to subdomains as well. */
export interface CosmeticData {
  /** Selectors hidden on every site. */
  generic: string[];
  /** Selectors hidden on particular sites. */
  specific: Record<string, string[]>;
  /** Selectors that must not be hidden on particular sites. */
  exceptions: Record<string, string[]>;
  /** Sites where generic hiding is off (`$generichide`). */
  genericHide: string[];
  /** Sites where site-specific hiding is off (`$specifichide`). */
  specificHide: string[];
}

export interface CompileStats {
  /** Lines that were filters, i.e. not comments or blank. */
  filters: number;
  rules: number;
  regexRules: number;
  genericSelectors: number;
  specificSelectors: number;
  /** Filters skipped, by reason. */
  unsupported: Record<string, number>;
}

export interface RejectedFilter {
  line: number;
  text: string;
  reason: string;
}

export interface CompileResult {
  rules: RuleSpec[];
  cosmetic: CosmeticData;
  stats: CompileStats;
  rejected: RejectedFilter[];
}

export interface CompileOptions {
  /**
   * Whether the browser accepts a regular expression as a `regexFilter`. Browsers compile
   * them with RE2 under a small memory limit, and one rejected expression makes a whole
   * ruleset fail to load, so only expressions the browser has confirmed are kept. Without
   * this check every regex filter is rejected; build-time lists cannot be checked exactly.
   */
  isRegexSupported?: (regex: string, caseSensitive: boolean) => boolean;
  /** DNR evaluates a limited number of regular-expression rules per ruleset. */
  maxRegexRules?: number;
  /** Keep the first N rejected filters for display; 0 keeps none. */
  keepRejected?: number;
}

const COMMENT = /^(?:!|\[|#(?:\s|$))/;
const HOSTS_FILE_ENTRY = /^(?:0\.0\.0\.0|127\.0\.0\.1)\s+([^\s#]+)/;
const ADGUARD_HTML_FILTER = /^[^/|@"!]*?\$@?\$/;

/** Compiles a filter list into DNR rules and element-hiding data. */
export function compileFilterList(
  lines: readonly string[],
  { isRegexSupported, maxRegexRules = 1000, keepRejected = 0 }: CompileOptions = {},
): CompileResult {
  const badfiltered = collectBadfilters(lines);
  const stats: CompileStats = {
    filters: 0,
    rules: 0,
    regexRules: 0,
    genericSelectors: 0,
    specificSelectors: 0,
    unsupported: {},
  };
  const rejected: RejectedFilter[] = [];
  const reject = (line: number, text: string, reason: string) => {
    stats.unsupported[reason] = (stats.unsupported[reason] ?? 0) + 1;
    if (rejected.length < keepRejected) rejected.push({ line, text, reason });
  };

  const rules: RuleSpec[] = [];
  const seenRules = new Set<string>();
  const hostGroups = new Map<string, { template: RuleSpec; hosts: Set<string> }>();
  const generic = new Set<string>();
  const genericExceptions = new Set<string>();
  const specific = new Map<string, Set<string>>();
  const exceptions = new Map<string, Set<string>>();
  const genericHide = new Set<string>();
  const specificHide = new Set<string>();

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    let line = rawLine.trim();
    if (line === '' || COMMENT.test(line) || line.startsWith('!#')) return;
    stats.filters += 1;

    const hostsEntry = HOSTS_FILE_ENTRY.exec(line)?.[1];
    if (hostsEntry !== undefined) line = `||${hostsEntry}^`;
    if (badfiltered.has(line) || hasOption(line, 'badfilter')) return;
    if (ADGUARD_HTML_FILTER.test(line)) return reject(lineNumber, line, 'HTML filter');

    const cosmetic = parseCosmeticFilter(line);
    if (cosmetic !== null) {
      if (cosmetic.kind === 'unsupported') return reject(lineNumber, line, cosmetic.reason);
      const { selector, include, exclude, exception } = cosmetic;
      if (include.length === 0 && exclude.length === 0) {
        (exception ? genericExceptions : generic).add(selector);
        return;
      }
      // `~site.example##.ad` hides everywhere except on site.example.
      if (include.length === 0 && !exception) generic.add(selector);
      for (const host of include) addTo(exception ? exceptions : specific, host, selector);
      for (const host of exclude) addTo(exceptions, host, selector);
      return;
    }

    const result = convertNetworkFilter(line);
    if (result.kind === 'unsupported') return reject(lineNumber, line, result.reason);
    if (result.kind === 'cosmetic-exception') {
      for (const host of result.hosts) {
        if (result.scope !== 'specific') genericHide.add(host);
        if (result.scope !== 'generic') specificHide.add(host);
      }
      return;
    }

    const { rule, host } = result;
    const { regexFilter, isUrlFilterCaseSensitive = false } = rule.condition;
    if (regexFilter !== undefined) {
      if (!isRegexSupported?.(regexFilter, isUrlFilterCaseSensitive)) {
        return reject(lineNumber, line, 'regular expression not supported by the browser');
      }
      if (stats.regexRules >= maxRegexRules) return reject(lineNumber, line, 'regex rule limit');
      stats.regexRules += 1;
    }
    if (host !== undefined) {
      // `||host^` filters that differ only in their host become one rule listing every host.
      const { urlFilter: _hostPattern, ...rest } = rule.condition;
      const template = { ...rule, condition: rest };
      const key = JSON.stringify(template);
      const group = hostGroups.get(key) ?? { template, hosts: new Set<string>() };
      group.hosts.add(host);
      hostGroups.set(key, group);
      return;
    }
    const key = JSON.stringify(rule);
    if (!seenRules.has(key)) {
      seenRules.add(key);
      rules.push(rule);
    }
  });

  const grouped = [...hostGroups.values()].map(({ template, hosts }) => ({
    ...template,
    condition: { ...template.condition, requestDomains: [...hosts].sort() },
  }));
  const allRules = [...grouped, ...rules];
  stats.rules = allRules.length;

  const genericSelectors = [...generic].filter((selector) => !genericExceptions.has(selector));
  stats.genericSelectors = genericSelectors.length;
  stats.specificSelectors = [...specific.values()].reduce((sum, set) => sum + set.size, 0);

  return {
    rules: allRules,
    cosmetic: {
      generic: genericSelectors,
      specific: toRecord(specific),
      exceptions: toRecord(exceptions),
      genericHide: [...genericHide].sort(),
      specificHide: [...specificHide].sort(),
    },
    stats,
    rejected,
  };
}

/** `filter$badfilter` cancels `filter` wherever it appears in the same list. */
function collectBadfilters(lines: readonly string[]): Set<string> {
  const cancelled = new Set<string>();
  for (const raw of lines) {
    const line = raw.trim();
    if (!hasOption(line, 'badfilter')) continue;
    const { pattern, options } = splitOptions(line);
    const rest = options.filter((option) => option !== 'badfilter');
    cancelled.add(rest.length > 0 ? `${pattern}$${rest.join(',')}` : pattern);
  }
  return cancelled;
}

function hasOption(line: string, name: string): boolean {
  return line.includes(name) && splitOptions(line).options.includes(name);
}

function addTo(map: Map<string, Set<string>>, key: string, value: string): void {
  const set = map.get(key) ?? new Set<string>();
  set.add(value);
  map.set(key, set);
}

function toRecord(map: Map<string, Set<string>>): Record<string, string[]> {
  const entries = [...map].sort(([a], [b]) => (a < b ? -1 : 1));
  return Object.fromEntries(entries.map(([key, values]) => [key, [...values]]));
}
