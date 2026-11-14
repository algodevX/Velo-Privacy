import * as z from 'zod/mini';
import { DEFAULT_FILTER_LISTS } from '../adblock/catalog';
import { WHATSAPP_OPTIONS, YOUTUBE_OPTIONS } from '../site-tools';

/**
 * The complete, persisted user configuration.
 *
 * This schema is the single source of truth for both the shape of the settings and their
 * defaults: `SettingsSchema.parse({})` yields a fresh configuration. Every field has a
 * default so that imports and older stored versions are filled in rather than rejected.
 *
 * Bump `SETTINGS_VERSION` and add a step in migrations.ts for any change that is not purely
 * additive.
 */

export const SETTINGS_VERSION = 1;

/**
 * What happens to a site's cookies and storage.
 * - allow:   kept normally
 * - session: kept until the browser closes
 * - tab:     deleted once no open tab shows the site
 * - block:   never stored
 */
export const COOKIE_ACTIONS = ['allow', 'session', 'tab', 'block'] as const;
export type CookieAction = (typeof COOKIE_ACTIONS)[number];

export const SAFE_SEARCH_LEVELS = ['off', 'moderate', 'strict'] as const;
export type SafeSearch = (typeof SAFE_SEARCH_LEVELS)[number];

/**
 * WebRTC IP exposure.
 * - default:          browser default
 * - public_interface: expose only the public interface used for regular traffic
 * - proxied_only:     never use non-proxied UDP; strongest, may break calls without a proxy
 */
export const WEBRTC_POLICIES = ['default', 'public_interface', 'proxied_only'] as const;
export type WebRtcPolicy = (typeof WEBRTC_POLICIES)[number];

const string = (max: number) => z.string().check(z.trim(), z.minLength(1), z.maxLength(max));
const list = <T extends z.core.SomeType>(item: T, max: number) =>
  z._default(z.array(item).check(z.maxLength(max)), []);
const flag = (value: boolean) => z._default(z.boolean(), value);
const choice = <const T extends readonly [string, ...string[]]>(values: T, value: T[number]) =>
  z._default(z.enum(values), value);
/** A settings section. Missing sections are parsed from `{}`, so their fields get defaults. */
const section = <T extends z.core.$ZodLooseShape>(shape: T) => {
  const object = z.object(shape);
  // Every field of a section has a default, so an empty object is valid input.
  return z.prefault(object, {} as z.input<typeof object>);
};

/** Boolean settings with the defaults in `values`. */
function flags<const T extends Record<string, boolean>>(values: T) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, flag(value)])) as {
    [K in keyof T]: ReturnType<typeof flag>;
  };
}

const PasswordHashSchema = z.object({
  salt: string(64),
  hash: string(128),
  iterations: z.int().check(z.minimum(100_000)),
});
export type PasswordHash = z.infer<typeof PasswordHashSchema>;

const pattern = string(512);
const patternList = list(pattern, 10_000);
const wordList = list(string(256), 1_000);

export const CookieRuleSchema = z.object({
  pattern,
  action: z.enum(COOKIE_ACTIONS),
});
export type CookieRule = z.infer<typeof CookieRuleSchema>;

export const SettingsSchema = z.object({
  version: z._default(z.literal(SETTINGS_VERSION), SETTINGS_VERSION),

  cookies: section({
    defaultAction: choice(COOKIE_ACTIONS, 'allow'),
    rules: list(CookieRuleSchema, 10_000),
  }),

  history: section({
    /** Master switch. When false, new visits are removed as soon as they are recorded. */
    record: flag(true),
    /** Sites that never appear in history. */
    excludedSites: patternList,
    /** Pages whose URL or title contains any of these words never appear in history. */
    excludedKeywords: wordList,
    /** Delete history older than this many days; null keeps everything. */
    retentionDays: z._default(z.nullable(z.int().check(z.minimum(1), z.maximum(3650))), null),
    /** Remove finished downloads from the downloads list (files are kept). */
    eraseDownloads: flag(false),
  }),

  search: section({
    /** Strip cookies from search requests and wipe engine storage after use. */
    isolate: flag(true),
    /** Keep replaying the engine's consent cookie so cookie walls stay dismissed. */
    preserveConsent: flag(true),
    /** Region id from regions.ts; null leaves the engine's choice alone. */
    region: z._default(z.nullable(z.string()), null),
    /** Language code from regions.ts; null follows the region. */
    language: z._default(z.nullable(z.string()), null),
    safeSearch: z._default(z.nullable(z.enum(SAFE_SEARCH_LEVELS)), null),
    /** Google only: open the plain "Web" results view without AI summaries or widgets. */
    webResultsOnly: flag(false),
    /** Engines Velo leaves untouched. */
    disabledEngines: list(z.string(), 100),
  }),

  tracking: section({
    stripTrackingParams: flag(true),
    /** Additional query parameters to strip from every navigation. */
    extraTrackingParams: wordList,
    /** Block hyperlink-auditing pings and navigator.sendBeacon(). */
    blockPings: flag(true),
    /** Remove the Referer header from third-party subresource requests. */
    stripThirdPartyReferrer: flag(false),
    /** Send the Global Privacy Control signal. */
    sendGpc: flag(true),
    /**
     * Add noise to canvas, WebGL and audio readings and hide the graphics card's name, so
     * scripts cannot compute a stable fingerprint of the device.
     */
    resistFingerprinting: flag(true),
    /** Sites where the protections above are switched off. */
    allowedSites: patternList,
  }),

  browser: section({
    blockThirdPartyCookies: flag(true),
    /** Topics, Protected Audience (FLEDGE) and Attribution Reporting. */
    disableAdPrivacyApis: flag(true),
    /** Network prediction: DNS prefetching, preconnect and page preloading. */
    disablePreloading: flag(false),
    disableHyperlinkAuditing: flag(true),
    /** Stop sending address-bar keystrokes to the search engine for suggestions. */
    disableSearchSuggestions: flag(false),
    webRtcPolicy: choice(WEBRTC_POLICIES, 'public_interface'),
  }),

  media: section({
    /** Remove `disablePictureInPicture` so every video can use native picture-in-picture. */
    unlockPictureInPicture: flag(true),
    pictureInPictureExcludedSites: patternList,
  }),

  adblock: section({
    enabled: flag(true),
    /** Ids of enabled filter lists, from adblock/catalog.ts. */
    lists: z._default(z.array(z.string()), () => [...DEFAULT_FILTER_LISTS]),
    /** Hide page elements that filter lists mark as ads (cosmetic filtering). */
    hideElements: flag(true),
    /** The user's own filters, in Adblock Plus / uBlock Origin syntax. */
    customFilters: z._default(z.string().check(z.maxLength(500_000)), ''),
    /** Sites where ad blocking is off. */
    disabledSites: patternList,
  }),

  https: section({
    /** Upgrade every page and frame loaded over plain HTTP to HTTPS. */
    upgrade: flag(false),
    /** Sites still loaded over HTTP, for those that have no HTTPS version. */
    exceptions: patternList,
  }),

  youtube: section({
    /** Master switch: nothing runs on YouTube while this is off. */
    enabled: flag(false),
    ...flags(YOUTUBE_OPTIONS),
  }),

  whatsapp: section({
    /** Master switch: nothing runs on WhatsApp Web while this is off. */
    enabled: flag(false),
    ...flags(WHATSAPP_OPTIONS),
    autoLockMinutes: z._default(z.nullable(z.int().check(z.minimum(1), z.maximum(240))), null),
    /** PBKDF2 hash of the lock screen password; null when none is set. */
    password: z._default(z.nullable(PasswordHashSchema), null),
  }),

  panic: section({
    /** Shows the panic button in the toolbar popup and enables its keyboard shortcut. */
    enabled: flag(false),
  }),

  blocking: section({
    /** Every request to these sites is blocked. */
    blockedSites: patternList,
  }),
});

export type Settings = z.infer<typeof SettingsSchema>;
export type SettingsSection = Exclude<keyof Settings, 'version'>;

export function defaultSettings(): Settings {
  return SettingsSchema.parse({});
}
