/**
 * Filter lists bundled with Velo. Lists are downloaded and compiled at build time into
 * declarativeNetRequest rulesets, so blocking never depends on fetching code or rules at
 * runtime; a new release ships updated lists.
 *
 * Each list keeps its own licence, recorded here as stated in the list's header, and ships
 * as separate data files next to Velo's code.
 */

export type ListCategory = 'ads' | 'privacy' | 'cookies' | 'social' | 'annoyances' | 'regional';

export interface FilterListInfo {
  /** Also the ruleset id; must not start with an underscore. */
  readonly id: string;
  readonly name: string;
  readonly category: ListCategory;
  readonly url: string;
  readonly homepage: string;
  readonly license: string;
  readonly enabledByDefault: boolean;
}

export interface CategoryInfo {
  readonly id: ListCategory;
  readonly name: string;
  readonly description: string;
}

export const CATEGORIES: readonly CategoryInfo[] = [
  { id: 'ads', name: 'Ads', description: 'Banners, video ads and sponsored content' },
  {
    id: 'privacy',
    name: 'Trackers',
    description: 'Analytics, tracking pixels and fingerprinting scripts',
  },
  { id: 'cookies', name: 'Cookie notices', description: 'Hides cookie consent banners' },
  {
    id: 'social',
    name: 'Social widgets',
    description: 'Share buttons, like boxes and embedded feeds',
  },
  {
    id: 'annoyances',
    name: 'Annoyances',
    description: 'Newsletter pop-ups, app banners and other clutter',
  },
  { id: 'regional', name: 'Regional', description: 'Ads specific to sites in one language' },
];

const EASYLIST_LICENSE = 'GPL-3.0 or CC BY-SA 3.0';
const UBLOCK_LICENSE = 'GPL-3.0';

export const FILTER_LISTS: readonly FilterListInfo[] = [
  {
    id: 'easylist',
    name: 'EasyList',
    category: 'ads',
    url: 'https://easylist.to/easylist/easylist.txt',
    homepage: 'https://easylist.to/',
    license: EASYLIST_LICENSE,
    enabledByDefault: true,
  },
  {
    id: 'ublock-filters',
    name: 'uBlock filters',
    category: 'ads',
    url: 'https://ublockorigin.github.io/uAssets/filters/filters.txt',
    homepage: 'https://github.com/uBlockOrigin/uAssets',
    license: UBLOCK_LICENSE,
    enabledByDefault: true,
  },
  {
    id: 'ublock-unbreak',
    name: 'uBlock filters – Unbreak',
    category: 'ads',
    url: 'https://ublockorigin.github.io/uAssets/filters/unbreak.txt',
    homepage: 'https://github.com/uBlockOrigin/uAssets',
    license: UBLOCK_LICENSE,
    enabledByDefault: true,
  },
  {
    id: 'easyprivacy',
    name: 'EasyPrivacy',
    category: 'privacy',
    url: 'https://easylist.to/easylist/easyprivacy.txt',
    homepage: 'https://easylist.to/',
    license: EASYLIST_LICENSE,
    enabledByDefault: true,
  },
  {
    id: 'ublock-privacy',
    name: 'uBlock filters – Privacy',
    category: 'privacy',
    url: 'https://ublockorigin.github.io/uAssets/filters/privacy.txt',
    homepage: 'https://github.com/uBlockOrigin/uAssets',
    license: UBLOCK_LICENSE,
    enabledByDefault: true,
  },
  {
    id: 'easylist-cookie',
    name: 'EasyList Cookie List',
    category: 'cookies',
    url: 'https://secure.fanboy.co.nz/fanboy-cookiemonster.txt',
    homepage: 'https://easylist.to/',
    license: 'CC BY 3.0',
    enabledByDefault: false,
  },
  {
    id: 'fanboy-social',
    name: "Fanboy's Social Blocking List",
    category: 'social',
    url: 'https://easylist.to/easylist/fanboy-social.txt',
    homepage: 'https://easylist.to/',
    license: EASYLIST_LICENSE,
    enabledByDefault: false,
  },
  {
    id: 'ublock-annoyances',
    name: 'uBlock filters – Annoyances',
    category: 'annoyances',
    url: 'https://ublockorigin.github.io/uAssets/filters/annoyances.txt',
    homepage: 'https://github.com/uBlockOrigin/uAssets',
    license: UBLOCK_LICENSE,
    enabledByDefault: false,
  },
  {
    id: 'easylist-germany',
    name: 'EasyList Germany',
    category: 'regional',
    url: 'https://easylist.to/easylistgermany/easylistgermany.txt',
    homepage: 'https://easylist.to/',
    license: EASYLIST_LICENSE,
    enabledByDefault: false,
  },
  {
    id: 'liste-fr',
    name: 'Liste FR',
    category: 'regional',
    url: 'https://easylist-downloads.adblockplus.org/liste_fr.txt',
    homepage: 'https://forums.lanik.us/',
    license: 'CC BY-SA 3.0',
    enabledByDefault: false,
  },
  {
    id: 'easylist-italy',
    name: 'EasyList Italy',
    category: 'regional',
    url: 'https://easylist-downloads.adblockplus.org/easylistitaly.txt',
    homepage: 'https://easylist.to/',
    license: EASYLIST_LICENSE,
    enabledByDefault: false,
  },
  {
    id: 'easylist-spanish',
    name: 'EasyList Spanish',
    category: 'regional',
    url: 'https://easylist-downloads.adblockplus.org/easylistspanish.txt',
    homepage: 'https://easylist.to/',
    license: EASYLIST_LICENSE,
    enabledByDefault: false,
  },
  {
    id: 'easylist-dutch',
    name: 'EasyList Dutch',
    category: 'regional',
    url: 'https://easylist-downloads.adblockplus.org/easylistdutch.txt',
    homepage: 'https://easylist.to/',
    license: EASYLIST_LICENSE,
    enabledByDefault: false,
  },
];

export const DEFAULT_FILTER_LISTS: readonly string[] = FILTER_LISTS.filter(
  (l) => l.enabledByDefault,
).map((l) => l.id);

/** Per-list numbers produced by the build, published as filters/index.json. */
export interface FilterIndexEntry {
  readonly id: string;
  readonly rules: number;
  /** Rules 1 to `blockRules` block requests; the rest are exceptions and redirects. */
  readonly blockRules: number;
  readonly genericSelectors: number;
  readonly specificSelectors: number;
}

export interface FilterIndex {
  readonly builtAt: string;
  readonly lists: readonly FilterIndexEntry[];
}

export const FILTER_INDEX_PATH = 'filters/index.json';
export const rulesetPath = (id: string) => `filters/${id}.rules.json`;
export const cosmeticDataPath = (id: string) => `filters/${id}.cosmetic.json`;
