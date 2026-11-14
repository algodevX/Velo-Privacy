import { domainMatchPattern, domainsOf } from '../../shared/patterns';
import { detectCapabilities } from '../../shared/platform';
import { compileBlockingRules, compileTrackingRules } from '../../shared/tracking';
import { setContentScript } from '../content-scripts';
import type { Module } from '../module';
import { installRules } from '../rules';

const capabilities = detectCapabilities();

/**
 * Tracking parameters, pings, referrers, Global Privacy Control, fingerprinting and the
 * user's blocklist.
 */
export function createTrackingModule(): Module {
  return {
    name: 'tracking',
    sections: ['tracking', 'blocking'],

    async apply({ tracking, blocking }) {
      await installRules('tracking', compileTrackingRules(tracking));
      await installRules('blocking', compileBlockingRules(blocking));

      const excludeMatches = domainsOf(tracking.allowedSites).map(domainMatchPattern);
      // The header tells servers; navigator.globalPrivacyControl tells scripts.
      await setContentScript(
        'gpc',
        tracking.sendGpc
          ? {
              js: ['content/gpc.js'],
              matches: ['<all_urls>'],
              excludeMatches,
              runAt: 'document_start',
              allFrames: true,
              world: 'MAIN',
            }
          : null,
      );
      await setContentScript(
        'fingerprint',
        tracking.resistFingerprinting
          ? {
              js: ['content/fingerprint.js'],
              matches: ['<all_urls>'],
              excludeMatches,
              runAt: 'document_start',
              allFrames: true,
              world: 'MAIN',
              ...(capabilities.chromium && { matchOriginAsFallback: true }),
            }
          : null,
      );
    },
  };
}
