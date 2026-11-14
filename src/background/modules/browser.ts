import type { Settings, WebRtcPolicy } from '../../shared/settings/schema';
import type { Module } from '../module';

type IpHandlingPolicy = `${chrome.privacy.IPHandlingPolicy}`;

const WEBRTC_VALUES: Record<WebRtcPolicy, IpHandlingPolicy | null> = {
  default: null,
  public_interface: 'default_public_interface_only',
  proxied_only: 'disable_non_proxied_udp',
};

/**
 * Browser-level privacy preferences (chrome.privacy).
 *
 * Options that are switched off are cleared rather than set to the opposite value, which
 * hands the decision back to the user's own browser settings.
 */
export function createBrowserModule(): Module {
  return {
    name: 'browser',
    sections: ['browser'],

    async apply({ browser }) {
      const results = await Promise.allSettled(
        preferenceUpdates(browser).map((update) => update()),
      );
      for (const result of results) {
        if (result.status === 'rejected') {
          console.warn('Privacy preference not applied:', result.reason);
        }
      }
    },
  };
}

function preferenceUpdates(browser: Settings['browser']): (() => Promise<void>)[] {
  // Not every Chromium browser ships every preference (Brave removes the Privacy Sandbox
  // APIs, for instance), so all of them are treated as optional.
  const websites: Partial<typeof chrome.privacy.websites> = chrome.privacy.websites;
  const network: Partial<typeof chrome.privacy.network> = chrome.privacy.network;
  const services: Partial<typeof chrome.privacy.services> = chrome.privacy.services;
  const disabledIf = (condition: boolean) => (condition ? false : null);

  return [
    update(websites.thirdPartyCookiesAllowed, disabledIf(browser.blockThirdPartyCookies)),
    update(websites.topicsEnabled, disabledIf(browser.disableAdPrivacyApis)),
    update(websites.fledgeEnabled, disabledIf(browser.disableAdPrivacyApis)),
    update(websites.adMeasurementEnabled, disabledIf(browser.disableAdPrivacyApis)),
    update(websites.hyperlinkAuditingEnabled, disabledIf(browser.disableHyperlinkAuditing)),
    update(network.networkPredictionEnabled, disabledIf(browser.disablePreloading)),
    update(services.searchSuggestEnabled, disabledIf(browser.disableSearchSuggestions)),
    update(network.webRTCIPHandlingPolicy, WEBRTC_VALUES[browser.webRtcPolicy]),
  ];
}

/** Sets `setting` to `value`, or releases it when `value` is null. */
function update<T>(
  setting: chrome.types.ChromeSetting<T> | undefined,
  value: T | null,
): () => Promise<void> {
  return async () => {
    if (setting === undefined) return;
    if (value === null) await setting.clear({});
    else await setting.set({ value });
  };
}
