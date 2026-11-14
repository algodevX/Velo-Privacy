/**
 * Regions and languages offered in the global search preferences.
 *
 * Engines identify regions differently, so the engine-specific codes that cannot be derived
 * from ISO codes are spelled out here rather than computed.
 */

export interface Region {
  /** ISO 3166-1 alpha-2, lowercase. */
  readonly id: string;
  readonly name: string;
  /** Default language (ISO 639-1) for results in this region. */
  readonly language: string;
  /** DuckDuckGo `kl` value. */
  readonly duckduckgo: string;
}

export interface Language {
  /** ISO 639-1. */
  readonly id: string;
  readonly name: string;
  /** Startpage `language` / `lui` value, where Startpage offers the language. */
  readonly startpage?: string;
}

export const REGIONS: readonly Region[] = [
  { id: 'au', name: 'Australia', language: 'en', duckduckgo: 'au-en' },
  { id: 'at', name: 'Austria', language: 'de', duckduckgo: 'at-de' },
  { id: 'br', name: 'Brazil', language: 'pt', duckduckgo: 'br-pt' },
  { id: 'ca', name: 'Canada', language: 'en', duckduckgo: 'ca-en' },
  { id: 'dk', name: 'Denmark', language: 'da', duckduckgo: 'dk-da' },
  { id: 'fi', name: 'Finland', language: 'fi', duckduckgo: 'fi-fi' },
  { id: 'fr', name: 'France', language: 'fr', duckduckgo: 'fr-fr' },
  { id: 'de', name: 'Germany', language: 'de', duckduckgo: 'de-de' },
  { id: 'in', name: 'India', language: 'en', duckduckgo: 'in-en' },
  { id: 'ie', name: 'Ireland', language: 'en', duckduckgo: 'ie-en' },
  { id: 'it', name: 'Italy', language: 'it', duckduckgo: 'it-it' },
  { id: 'jp', name: 'Japan', language: 'ja', duckduckgo: 'jp-jp' },
  { id: 'mx', name: 'Mexico', language: 'es', duckduckgo: 'mx-es' },
  { id: 'nl', name: 'Netherlands', language: 'nl', duckduckgo: 'nl-nl' },
  { id: 'nz', name: 'New Zealand', language: 'en', duckduckgo: 'nz-en' },
  { id: 'no', name: 'Norway', language: 'no', duckduckgo: 'no-no' },
  { id: 'pl', name: 'Poland', language: 'pl', duckduckgo: 'pl-pl' },
  { id: 'pt', name: 'Portugal', language: 'pt', duckduckgo: 'pt-pt' },
  { id: 'es', name: 'Spain', language: 'es', duckduckgo: 'es-es' },
  { id: 'se', name: 'Sweden', language: 'sv', duckduckgo: 'se-sv' },
  { id: 'ch', name: 'Switzerland', language: 'de', duckduckgo: 'ch-de' },
  { id: 'tr', name: 'Türkiye', language: 'tr', duckduckgo: 'tr-tr' },
  { id: 'gb', name: 'United Kingdom', language: 'en', duckduckgo: 'uk-en' },
  { id: 'us', name: 'United States', language: 'en', duckduckgo: 'us-en' },
];

export const LANGUAGES: readonly Language[] = [
  { id: 'da', name: 'Dansk', startpage: 'dansk' },
  { id: 'de', name: 'Deutsch', startpage: 'deutsch' },
  { id: 'en', name: 'English', startpage: 'english' },
  { id: 'es', name: 'Español', startpage: 'espanol' },
  { id: 'fr', name: 'Français', startpage: 'francais' },
  { id: 'it', name: 'Italiano', startpage: 'italiano' },
  { id: 'nl', name: 'Nederlands', startpage: 'nederlands' },
  { id: 'no', name: 'Norsk', startpage: 'norsk' },
  { id: 'pl', name: 'Polski', startpage: 'polski' },
  { id: 'pt', name: 'Português', startpage: 'portugues' },
  { id: 'fi', name: 'Suomi', startpage: 'suomi' },
  { id: 'sv', name: 'Svenska', startpage: 'svenska' },
  { id: 'tr', name: 'Türkçe', startpage: 'turkce' },
  { id: 'ja', name: '日本語', startpage: 'nihongo' },
];

export function findRegion(id: string | null): Region | undefined {
  return id === null ? undefined : REGIONS.find((region) => region.id === id);
}

export function findLanguage(id: string | null | undefined): Language | undefined {
  return id === null || id === undefined
    ? undefined
    : LANGUAGES.find((language) => language.id === id);
}
