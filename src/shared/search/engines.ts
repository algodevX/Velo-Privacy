import type { SafeSearch, Settings } from '../settings/schema';
import { findLanguage, findRegion, type Language, type Region } from './regions';

/** Search preferences resolved from settings, ready to be mapped onto engine parameters. */
export interface SearchPreferences {
  readonly region?: Region;
  readonly language?: Language;
  readonly safeSearch?: SafeSearch;
}

export interface SearchEngine {
  readonly id: string;
  readonly name: string;
  /** Hostnames that serve results. */
  readonly hosts: readonly string[];
  /**
   * True when the hosts serve nothing but search, so every request to them can be stripped
   * of cookies and their storage wiped. Otherwise only `isolatedPaths` are isolated, which
   * keeps other services on the same host (Maps, accounts) signed in.
   */
  readonly dedicatedHosts: boolean;
  /** Path prefixes of results pages and suggestion endpoints. Ignored for dedicated hosts. */
  readonly isolatedPaths: readonly string[];
  /** Path prefixes of results pages that receive preference parameters. */
  readonly resultPaths: readonly string[];
  /** Name of the query parameter holding the search terms. */
  readonly queryParam: string;
  /**
   * Cookies that only record the user's answer to a consent banner. They are replayed on
   * isolated requests so the banner does not return on every search.
   */
  readonly consentCookies?: readonly string[];
  /** Parameter that selects a plain web results view, if the engine has one. */
  readonly webResultsParam?: { readonly key: string; readonly value: string };
  /** URL parameters expressing `prefs`. Omitted keys are left to the engine. */
  readonly params: (prefs: SearchPreferences) => Record<string, string>;
}

const GOOGLE_DOMAINS = [
  'google.com',
  'google.at',
  'google.be',
  'google.ca',
  'google.ch',
  'google.co.in',
  'google.co.jp',
  'google.co.nz',
  'google.co.uk',
  'google.com.au',
  'google.com.br',
  'google.com.mx',
  'google.com.tr',
  'google.de',
  'google.dk',
  'google.es',
  'google.fi',
  'google.fr',
  'google.ie',
  'google.it',
  'google.nl',
  'google.no',
  'google.pl',
  'google.pt',
  'google.se',
];

/** Maps a SafeSearch level onto an engine's values; a missing level leaves the engine default. */
function safeSearchParam(
  key: string,
  level: SafeSearch | undefined,
  values: Partial<Record<SafeSearch, string>>,
): Record<string, string> {
  const value = level === undefined ? undefined : values[level];
  return value === undefined ? {} : { [key]: value };
}

export const SEARCH_ENGINES: readonly SearchEngine[] = [
  {
    id: 'google',
    name: 'Google',
    hosts: GOOGLE_DOMAINS.map((domain) => `www.${domain}`),
    dedicatedHosts: false,
    isolatedPaths: ['/search', '/complete/search'],
    resultPaths: ['/search'],
    queryParam: 'q',
    consentCookies: ['SOCS', 'CONSENT'],
    webResultsParam: { key: 'udm', value: '14' },
    params: ({ region, language, safeSearch }) => ({
      pws: '0',
      ...(region && { gl: region.id }),
      ...(language && { hl: language.id }),
      ...safeSearchParam('safe', safeSearch, { off: 'off', strict: 'active' }),
    }),
  },
  {
    id: 'bing',
    name: 'Bing',
    hosts: ['www.bing.com'],
    dedicatedHosts: false,
    isolatedPaths: ['/search', '/images/search', '/videos/search', '/news/search', '/AS/'],
    resultPaths: ['/search', '/images/search', '/videos/search', '/news/search'],
    queryParam: 'q',
    params: ({ region, language, safeSearch }) => ({
      ...(region && { cc: region.id.toUpperCase() }),
      ...(language && { setlang: language.id }),
      ...safeSearchParam('adlt', safeSearch, {
        off: 'off',
        moderate: 'moderate',
        strict: 'strict',
      }),
    }),
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    hosts: ['duckduckgo.com', 'html.duckduckgo.com', 'lite.duckduckgo.com'],
    dedicatedHosts: true,
    isolatedPaths: [],
    resultPaths: ['/'],
    queryParam: 'q',
    params: ({ region, safeSearch }) => ({
      ...(region && { kl: region.duckduckgo }),
      ...safeSearchParam('kp', safeSearch, { off: '-2', moderate: '-1', strict: '1' }),
    }),
  },
  {
    id: 'startpage',
    name: 'Startpage',
    hosts: ['www.startpage.com', 'startpage.com'],
    dedicatedHosts: true,
    isolatedPaths: [],
    resultPaths: ['/sp/search', '/do/search', '/do/dsearch'],
    queryParam: 'query',
    params: ({ language, safeSearch }) => ({
      ...(language?.startpage && { language: language.startpage, lui: language.startpage }),
      ...safeSearchParam('qadf', safeSearch, { off: 'none', strict: 'heavy' }),
    }),
  },
  {
    id: 'brave',
    name: 'Brave Search',
    hosts: ['search.brave.com'],
    dedicatedHosts: true,
    isolatedPaths: [],
    resultPaths: ['/search', '/images', '/videos', '/news'],
    queryParam: 'q',
    params: ({ region, safeSearch }) => ({
      ...(region && { country: region.id }),
      ...safeSearchParam('safesearch', safeSearch, {
        off: 'off',
        moderate: 'moderate',
        strict: 'strict',
      }),
    }),
  },
  {
    id: 'qwant',
    name: 'Qwant',
    hosts: ['www.qwant.com'],
    dedicatedHosts: true,
    isolatedPaths: [],
    resultPaths: ['/'],
    queryParam: 'q',
    params: ({ region, language, safeSearch }) => ({
      ...(region && language && { locale: `${language.id}_${region.id.toUpperCase()}` }),
      ...safeSearchParam('s', safeSearch, { off: '0', moderate: '1', strict: '2' }),
    }),
  },
  {
    id: 'ecosia',
    name: 'Ecosia',
    hosts: ['www.ecosia.org'],
    dedicatedHosts: true,
    isolatedPaths: [],
    resultPaths: ['/search'],
    queryParam: 'q',
    params: () => ({}),
  },
  {
    id: 'mojeek',
    name: 'Mojeek',
    hosts: ['www.mojeek.com'],
    dedicatedHosts: true,
    isolatedPaths: [],
    resultPaths: ['/search'],
    queryParam: 'q',
    params: ({ safeSearch }) => safeSearchParam('safe', safeSearch, { off: '0', strict: '1' }),
  },
];

export function resolvePreferences(search: Settings['search']): SearchPreferences {
  const region = findRegion(search.region);
  const language = findLanguage(search.language ?? region?.language);
  return {
    ...(region && { region }),
    ...(language && { language }),
    ...(search.safeSearch !== null && { safeSearch: search.safeSearch }),
  };
}

export function enabledEngines(search: Settings['search']): SearchEngine[] {
  return SEARCH_ENGINES.filter((engine) => !search.disabledEngines.includes(engine.id));
}

export function engineForHost(hostname: string): SearchEngine | undefined {
  return SEARCH_ENGINES.find((engine) => engine.hosts.includes(hostname));
}
