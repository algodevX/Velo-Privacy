import { useEffect, useState } from 'preact/hooks';
import { detectCapabilities } from '../../../shared/platform';
import { PRESETS, activePreset, applyPreset } from '../../../shared/settings/presets';
import type { CookieAction, Settings } from '../../../shared/settings/schema';
import { Button } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { FeatureTile, Notice, Section, Segmented } from '../../components/layout';
import { plural } from '../../labels';
import { setPanicEnabled } from '../../panic';
import type { SectionProps } from '../section';

const ALL_SITES = { origins: ['<all_urls>'] };
const capabilities = detectCapabilities();

const COOKIE_STATUS: Record<CookieAction, string> = {
  allow: 'Sites keep data',
  session: 'Deleted on exit',
  tab: 'Deleted when tabs close',
  block: 'Blocked',
};

/** The protections whose absence the overview points out. */
function missingProtections(settings: Settings): string[] {
  const missing: [boolean, string][] = [
    [settings.adblock.enabled, 'ad blocking'],
    [settings.tracking.stripTrackingParams && settings.tracking.blockPings, 'tracker blocking'],
    [settings.tracking.resistFingerprinting, 'fingerprinting protection'],
    [settings.search.isolate, 'private search'],
  ];
  return missing.filter(([on]) => !on).map(([, name]) => name);
}

export function OverviewSection({ settings, update }: SectionProps) {
  const active = activePreset(settings);
  const missing = missingProtections(settings);
  const set = (mutate: (draft: Settings) => void) => void update(mutate);

  return (
    <>
      <SiteAccess />

      <section class="section">
        <div class="hero" data-state={missing.length === 0 ? 'protected' : 'partial'}>
          <div class="hero-status">
            <span class="badge">
              <Icon name={missing.length === 0 ? 'verified_user' : 'gpp_maybe'} size={36} />
            </span>
            <div>
              <h1 class="hero-title">
                {missing.length === 0 ? 'You’re protected' : 'Some protection is off'}
              </h1>
              <p class="hero-description">
                {missing.length === 0
                  ? 'Ads, trackers and fingerprinting are blocked on every site.'
                  : `Turn on ${joinList(missing)} for full protection.`}
              </p>
            </div>
          </div>
          <div class="hero-level">
            <Segmented
              label="Protection level"
              value={active?.id}
              segments={PRESETS.map((preset) => ({ value: preset.id, label: preset.name }))}
              onChange={(id) =>
                set((draft) => {
                  const preset = PRESETS.find((p) => p.id === id);
                  if (preset) applyPreset(draft, preset);
                })
              }
            />
            <p>
              {active?.summary ??
                'Custom: you’ve changed individual settings. Choose a level to reset them; your site lists and filters are kept.'}
            </p>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Protection</h2>
        </div>
        <div class="tiles">
          <FeatureTile
            icon="block"
            title="Ad blocking"
            status={
              settings.adblock.enabled
                ? plural(settings.adblock.lists.length, 'filter list')
                : 'Off'
            }
            href="#adblock"
            checked={settings.adblock.enabled}
            onChange={(on) =>
              set((draft) => {
                draft.adblock.enabled = on;
              })
            }
          />
          <FeatureTile
            icon="fingerprint"
            title="Fingerprinting"
            status={settings.tracking.resistFingerprinting ? 'Device hidden' : 'Off'}
            href="#tracking"
            checked={settings.tracking.resistFingerprinting}
            onChange={(on) =>
              set((draft) => {
                draft.tracking.resistFingerprinting = on;
              })
            }
          />
          <FeatureTile
            icon="visibility_off"
            title="Tracking"
            status={trackingSummary(settings)}
            href="#tracking"
          />
          <FeatureTile
            icon="cookie"
            title="Cookies"
            status={COOKIE_STATUS[settings.cookies.defaultAction]}
            href="#cookies"
          />
          <FeatureTile
            icon="search"
            title="Private search"
            status={settings.search.isolate ? 'Searches not linked' : 'Off'}
            href="#search"
            checked={settings.search.isolate}
            onChange={(on) =>
              set((draft) => {
                draft.search.isolate = on;
              })
            }
          />
          <FeatureTile
            icon="encrypted"
            title="HTTPS only"
            status={settings.https.upgrade ? 'Every page encrypted' : 'Off'}
            href="#browser"
            checked={settings.https.upgrade}
            onChange={(on) =>
              set((draft) => {
                draft.https.upgrade = on;
              })
            }
          />
          {capabilities.history && (
            <FeatureTile
              icon="history"
              title="History"
              status={settings.history.record ? 'Recording' : 'Paused'}
              href="#history"
              checked={settings.history.record}
              onChange={(on) =>
                set((draft) => {
                  draft.history.record = on;
                })
              }
            />
          )}
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Site tools</h2>
          <p class="section-description">
            Each runs only on its own site, and only while it is on.
          </p>
        </div>
        <div class="tiles">
          <FeatureTile
            icon="smart_display"
            title="YouTube"
            status={settings.youtube.enabled ? 'Distractions hidden' : 'Off'}
            href="#youtube"
            checked={settings.youtube.enabled}
            onChange={(on) =>
              set((draft) => {
                draft.youtube.enabled = on;
              })
            }
          />
          <FeatureTile
            icon="chat"
            title="WhatsApp Web"
            status={settings.whatsapp.enabled ? 'Chats blurred' : 'Off'}
            href="#whatsapp"
            checked={settings.whatsapp.enabled}
            onChange={(on) =>
              set((draft) => {
                draft.whatsapp.enabled = on;
              })
            }
          />
          <FeatureTile
            icon="picture_in_picture_alt"
            title="Picture-in-picture"
            status={settings.media.unlockPictureInPicture ? 'On every site' : 'Off'}
            href="#media"
            checked={settings.media.unlockPictureInPicture}
            onChange={(on) =>
              set((draft) => {
                draft.media.unlockPictureInPicture = on;
              })
            }
          />
          {capabilities.bookmarks && (
            <FeatureTile
              icon="emergency_home"
              title="Panic button"
              status={settings.panic.enabled ? 'In the toolbar' : 'Off'}
              href="#cleanup"
              checked={settings.panic.enabled}
              onChange={(on) => void setPanicEnabled(update, on)}
            />
          )}
          {capabilities.browsingData && (
            <FeatureTile
              icon="cleaning_services"
              title="Clear browsing data"
              status="History, cookies, cache"
              href="#cleanup"
            />
          )}
        </div>
      </section>
    </>
  );
}

function trackingSummary({ tracking }: Settings): string {
  const on = [
    tracking.stripTrackingParams,
    tracking.blockPings,
    tracking.stripThirdPartyReferrer,
    tracking.sendGpc,
  ].filter(Boolean).length;
  return on === 0 ? 'Off' : `${on} of 4 protections`;
}

function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/**
 * Some browsers (Firefox, Safari) let people withhold access to sites after installing.
 * Without it, Velo cannot act on pages, so ask for it plainly.
 */
function SiteAccess() {
  const [granted, setGranted] = useState(true);

  useEffect(() => {
    void chrome.permissions.contains(ALL_SITES).then(setGranted);
  }, []);

  if (granted) return null;
  return (
    <Section>
      <Notice
        kind="error"
        action={
          <Button
            variant="filled"
            onClick={() => void chrome.permissions.request(ALL_SITES).then(setGranted)}
          >
            Allow
          </Button>
        }
      >
        Velo needs access to all sites to block ads and trackers and to apply your settings.
      </Notice>
    </Section>
  );
}
