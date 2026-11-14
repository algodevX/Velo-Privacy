import type { CookieAction, Settings, WebRtcPolicy } from './schema';

/**
 * Presets set the protection switches; they never touch site lists or search preferences,
 * so switching presets can't destroy work the user put into their rules.
 */
export interface PresetValues {
  defaultCookieAction: CookieAction;
  isolateSearch: boolean;
  stripTrackingParams: boolean;
  blockPings: boolean;
  stripThirdPartyReferrer: boolean;
  sendGpc: boolean;
  resistFingerprinting: boolean;
  upgradeToHttps: boolean;
  blockThirdPartyCookies: boolean;
  disableAdPrivacyApis: boolean;
  disablePreloading: boolean;
  disableHyperlinkAuditing: boolean;
  disableSearchSuggestions: boolean;
  webRtcPolicy: WebRtcPolicy;
}

export type PresetId = 'balanced' | 'strict';

export interface Preset {
  id: PresetId;
  name: string;
  summary: string;
  values: PresetValues;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'balanced',
    name: 'Balanced',
    summary: 'Blocks ads, trackers and fingerprinting while keeping you signed in. Recommended.',
    values: {
      defaultCookieAction: 'allow',
      isolateSearch: true,
      stripTrackingParams: true,
      blockPings: true,
      stripThirdPartyReferrer: false,
      sendGpc: true,
      resistFingerprinting: true,
      upgradeToHttps: false,
      blockThirdPartyCookies: true,
      disableAdPrivacyApis: true,
      disablePreloading: false,
      disableHyperlinkAuditing: true,
      disableSearchSuggestions: false,
      webRtcPolicy: 'public_interface',
    },
  },
  {
    id: 'strict',
    name: 'Strict',
    summary:
      'Also forgets sites once their tabs close and loads every page over HTTPS. Expect to sign in more often.',
    values: {
      defaultCookieAction: 'tab',
      isolateSearch: true,
      stripTrackingParams: true,
      blockPings: true,
      stripThirdPartyReferrer: true,
      sendGpc: true,
      resistFingerprinting: true,
      upgradeToHttps: true,
      blockThirdPartyCookies: true,
      disableAdPrivacyApis: true,
      disablePreloading: true,
      disableHyperlinkAuditing: true,
      disableSearchSuggestions: true,
      webRtcPolicy: 'proxied_only',
    },
  },
];

export function presetValuesOf(settings: Settings): PresetValues {
  return {
    defaultCookieAction: settings.cookies.defaultAction,
    isolateSearch: settings.search.isolate,
    stripTrackingParams: settings.tracking.stripTrackingParams,
    blockPings: settings.tracking.blockPings,
    stripThirdPartyReferrer: settings.tracking.stripThirdPartyReferrer,
    sendGpc: settings.tracking.sendGpc,
    resistFingerprinting: settings.tracking.resistFingerprinting,
    upgradeToHttps: settings.https.upgrade,
    blockThirdPartyCookies: settings.browser.blockThirdPartyCookies,
    disableAdPrivacyApis: settings.browser.disableAdPrivacyApis,
    disablePreloading: settings.browser.disablePreloading,
    disableHyperlinkAuditing: settings.browser.disableHyperlinkAuditing,
    disableSearchSuggestions: settings.browser.disableSearchSuggestions,
    webRtcPolicy: settings.browser.webRtcPolicy,
  };
}

export function applyPreset(draft: Settings, preset: Preset): void {
  const v = preset.values;
  draft.cookies.defaultAction = v.defaultCookieAction;
  draft.search.isolate = v.isolateSearch;
  draft.tracking.stripTrackingParams = v.stripTrackingParams;
  draft.tracking.blockPings = v.blockPings;
  draft.tracking.stripThirdPartyReferrer = v.stripThirdPartyReferrer;
  draft.tracking.sendGpc = v.sendGpc;
  draft.tracking.resistFingerprinting = v.resistFingerprinting;
  draft.https.upgrade = v.upgradeToHttps;
  draft.browser.blockThirdPartyCookies = v.blockThirdPartyCookies;
  draft.browser.disableAdPrivacyApis = v.disableAdPrivacyApis;
  draft.browser.disablePreloading = v.disablePreloading;
  draft.browser.disableHyperlinkAuditing = v.disableHyperlinkAuditing;
  draft.browser.disableSearchSuggestions = v.disableSearchSuggestions;
  draft.browser.webRtcPolicy = v.webRtcPolicy;
}

/** The preset the settings currently match exactly, if any. */
export function activePreset(settings: Settings): Preset | undefined {
  const current = presetValuesOf(settings);
  return PRESETS.find((preset) =>
    (Object.keys(preset.values) as (keyof PresetValues)[]).every(
      (key) => preset.values[key] === current[key],
    ),
  );
}
