import {
  ALL_RESOURCE_TYPES,
  PRIORITY,
  type ResourceType,
  type RuleCondition,
  type RuleSpec,
} from '../dnr';
import { parseDomainList, toAsciiHostname } from './domains';

/**
 * Converts one network filter (Adblock Plus / uBlock Origin syntax) into a
 * declarativeNetRequest rule.
 *
 * Adblock Plus patterns (`||`, `|`, `^`, `*`) are what DNR's `urlFilter` was modelled on,
 * so patterns carry over unchanged; the work is in mapping options. Filters whose meaning
 * cannot be preserved exactly are rejected rather than approximated, because a broader
 * rule than intended breaks sites.
 */

export type NetworkFilterResult =
  | {
      readonly kind: 'rule';
      readonly rule: RuleSpec;
      /** Set when the filter is exactly `||host^`, so rules can be merged by host. */
      readonly host?: string;
    }
  | {
      readonly kind: 'cosmetic-exception';
      readonly scope: 'generic' | 'specific' | 'all';
      readonly hosts: readonly string[];
    }
  | { readonly kind: 'unsupported'; readonly reason: string };

const TYPE_OPTIONS: Readonly<Record<string, ResourceType>> = {
  script: 'script',
  image: 'image',
  stylesheet: 'stylesheet',
  css: 'stylesheet',
  object: 'object',
  'object-subrequest': 'object',
  xmlhttprequest: 'xmlhttprequest',
  xhr: 'xmlhttprequest',
  subdocument: 'sub_frame',
  frame: 'sub_frame',
  ping: 'ping',
  beacon: 'ping',
  media: 'media',
  font: 'font',
  websocket: 'websocket',
  other: 'other',
};

const COSMETIC_EXCEPTIONS: Readonly<Record<string, 'generic' | 'specific' | 'all'>> = {
  generichide: 'generic',
  ghide: 'generic',
  specifichide: 'specific',
  shide: 'specific',
  elemhide: 'all',
  ehide: 'all',
};

/** Options that only annotate a filter and do not change what it matches. */
const IGNORED_OPTIONS = new Set(['reason']);

const PLAIN_HOSTNAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const EXACT_HOST_PATTERN =
  /^\|\|([a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+)\^$/;
const OPTION_LIST = /^~?[a-z0-9_-]+(=[^,]*)?(,~?[a-z0-9_-]+(=[^,]*)?)*$/i;
const NON_PORTABLE_REGEX = /\(\?[=!<]|\\[1-9]/;
const REMOVABLE_PARAM = /^[A-Za-z0-9_.\-[\]]+$/;

export function convertNetworkFilter(line: string): NetworkFilterResult {
  const exception = line.startsWith('@@');
  const { pattern, options } = splitOptions(exception ? line.slice(2) : line);

  const condition: RuleCondition = {};
  const types = new Set<ResourceType>();
  const excludedTypes = new Set<ResourceType>();
  let document = false;
  let important = false;
  let matchCase = false;
  let removeParam: string | undefined;
  let cosmeticScope: 'generic' | 'specific' | 'all' | undefined;

  for (const option of options) {
    const negated = option.startsWith('~');
    const [rawName = '', value = ''] = splitOnce(negated ? option.slice(1) : option, '=');
    const name = rawName.toLowerCase();

    const type = TYPE_OPTIONS[name];
    if (type !== undefined) {
      (negated ? excludedTypes : types).add(type);
      continue;
    }
    const scope = COSMETIC_EXCEPTIONS[name];
    if (scope !== undefined) {
      cosmeticScope = scope;
      continue;
    }
    if (IGNORED_OPTIONS.has(name)) continue;

    switch (name) {
      case 'document':
      case 'doc':
        if (negated) return unsupported('~document');
        document = true;
        break;
      case 'all':
        document = true;
        for (const t of ALL_RESOURCE_TYPES) if (t !== 'main_frame') types.add(t);
        break;
      case 'third-party':
      case '3p':
        condition.domainType = negated ? 'firstParty' : 'thirdParty';
        break;
      case 'first-party':
      case '1p':
        condition.domainType = negated ? 'thirdParty' : 'firstParty';
        break;
      case 'domain':
      case 'from': {
        const list = parseDomainList(value, '|');
        if (list.skipped > 0 && list.include.length === 0) return unsupported('entity domain');
        if (list.include.length > 0) condition.initiatorDomains = list.include;
        if (list.exclude.length > 0) condition.excludedInitiatorDomains = list.exclude;
        break;
      }
      case 'to': {
        const list = parseDomainList(value, '|');
        if (list.skipped > 0 && list.include.length === 0) return unsupported('entity domain');
        if (list.include.length > 0) condition.requestDomains = list.include;
        if (list.exclude.length > 0) condition.excludedRequestDomains = list.exclude;
        break;
      }
      case 'denyallow': {
        const list = parseDomainList(value, '|');
        if (list.skipped > 0 || list.exclude.length > 0) return unsupported('denyallow syntax');
        condition.excludedRequestDomains = [
          ...(condition.excludedRequestDomains ?? []),
          ...list.include,
        ];
        break;
      }
      case 'method': {
        const methods = value.toLowerCase().split('|');
        if (methods.some((m) => !/^[a-z]+$/.test(m))) return unsupported('negated method');
        condition.requestMethods = methods as RuleCondition['requestMethods'];
        break;
      }
      case 'match-case':
        matchCase = true;
        break;
      case 'important':
        important = true;
        break;
      case 'removeparam':
        if (!REMOVABLE_PARAM.test(value)) return unsupported('removeparam pattern');
        removeParam = value;
        break;
      default:
        return unsupported(`$${name}`);
    }
  }

  if (cosmeticScope !== undefined) {
    if (!exception) return unsupported('cosmetic option on a blocking filter');
    const host = hostOfPattern(pattern);
    const hosts = host !== undefined ? [host] : (condition.initiatorDomains ?? []);
    if (hosts.length === 0) return unsupported('cosmetic exception without hosts');
    return { kind: 'cosmetic-exception', scope: cosmeticScope, hosts };
  }

  // Pattern
  let host: string | undefined;
  if (pattern.length > 2 && pattern.startsWith('/') && pattern.endsWith('/')) {
    const source = pattern.slice(1, -1);
    if (NON_PORTABLE_REGEX.test(source)) return unsupported('regex syntax');
    condition.regexFilter = source;
  } else {
    const normalized = PLAIN_HOSTNAME.test(pattern) ? `||${pattern}^` : pattern;
    host = EXACT_HOST_PATTERN.exec(normalized)?.[1];
    const urlFilter = trimWildcards(normalized);
    if (urlFilter !== '') {
      if (/^\|+$/.test(urlFilter)) return unsupported('empty pattern');
      if (!/^[\x21-\x7e]+$/.test(urlFilter)) return unsupported('non-ASCII pattern');
      if (/.\|./.test(urlFilter.replace(/^\|\|?/, ''))) return unsupported('pipe inside pattern');
      condition.urlFilter = urlFilter;
    }
  }
  if (matchCase && (condition.urlFilter !== undefined || condition.regexFilter !== undefined)) {
    condition.isUrlFilterCaseSensitive = true;
  }

  // Resource types. `excludedResourceTypes` would include main_frame, which filters never
  // mean to block, so exclusions are expanded into an explicit list instead.
  let resourceTypes: ResourceType[] | undefined;
  if (types.size > 0) {
    resourceTypes = [...types].filter((t) => !excludedTypes.has(t));
  } else if (excludedTypes.size > 0) {
    resourceTypes = ALL_RESOURCE_TYPES.filter((t) => t !== 'main_frame' && !excludedTypes.has(t));
  }
  if (document) resourceTypes = [...(resourceTypes ?? []), 'main_frame'];
  if (resourceTypes !== undefined) {
    if (resourceTypes.length === 0) return unsupported('no resource types');
    condition.resourceTypes = resourceTypes;
  }

  // Action
  let rule: RuleSpec;
  if (removeParam !== undefined) {
    if (exception) return unsupported('removeparam exception');
    condition.resourceTypes ??= ['main_frame', 'sub_frame', 'xmlhttprequest'];
    rule = {
      priority: PRIORITY.filterBlock,
      action: {
        type: 'redirect',
        redirect: { transform: { queryTransform: { removeParams: [removeParam] } } },
      },
      condition,
    };
  } else if (exception && document && types.size === 0) {
    condition.resourceTypes = ['main_frame', 'sub_frame'];
    rule = { priority: PRIORITY.filterException, action: { type: 'allowAllRequests' }, condition };
  } else if (exception) {
    rule = { priority: PRIORITY.filterException, action: { type: 'allow' }, condition };
  } else {
    const priority = important ? PRIORITY.filterImportant : PRIORITY.filterBlock;
    rule = { priority, action: { type: 'block' }, condition };
  }

  const groupable = host !== undefined && condition.requestDomains === undefined && !matchCase;
  return groupable ? { kind: 'rule', rule, host } : { kind: 'rule', rule };
}

/** Separates `pattern$options`. A `$` only starts options if what follows parses as options. */
export function splitOptions(text: string): { pattern: string; options: string[] } {
  const index = text.lastIndexOf('$');
  if (index >= 0) {
    const optionText = text.slice(index + 1);
    if (OPTION_LIST.test(optionText)) {
      return { pattern: text.slice(0, index), options: optionText.split(',') };
    }
  }
  return { pattern: text, options: [] };
}

function hostOfPattern(pattern: string): string | undefined {
  const exact = /^\|\|([^/^*|$]+)\^?$/.exec(pattern)?.[1];
  return exact === undefined ? undefined : (toAsciiHostname(exact) ?? undefined);
}

/** Leading and trailing `*` are implicit in DNR; `||*` is not allowed at all. */
function trimWildcards(pattern: string): string {
  let result = pattern;
  if (result.startsWith('||*')) result = result.slice(2);
  return result.replace(/^\*+/, '').replace(/\*+$/, '');
}

function splitOnce(text: string, separator: string): [string, string?] {
  const index = text.indexOf(separator);
  return index < 0 ? [text] : [text.slice(0, index), text.slice(index + 1)];
}

function unsupported(reason: string): NetworkFilterResult {
  return { kind: 'unsupported', reason };
}
