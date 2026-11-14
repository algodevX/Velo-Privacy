import { Section, SwitchRow } from '../../components/layout';
import { EditableList, sitePatternValidator, wordValidator } from '../../components/lists';
import type { SectionProps } from '../section';

export function TrackingSection({ settings, update }: SectionProps) {
  const { tracking } = settings;
  return (
    <>
      <Section
        title="Fingerprinting"
        description="Scripts can recognise your device from tiny differences in how it draws graphics and plays sound, even without cookies."
      >
        <SwitchRow
          icon="fingerprint"
          title="Block fingerprinting"
          description="Adds invisible noise to canvas, WebGL and audio readings, changing on every page load, and hides the name of your graphics card"
          checked={tracking.resistFingerprinting}
          onChange={(on) =>
            void update((draft) => {
              draft.tracking.resistFingerprinting = on;
            })
          }
        />
      </Section>

      <Section title="Trackers">
        <SwitchRow
          title="Remove tracking parameters from links"
          description={
            <>
              Strips identifiers such as <code>utm_source</code>, <code>fbclid</code> and{' '}
              <code>gclid</code> before the page loads
            </>
          }
          checked={tracking.stripTrackingParams}
          onChange={(on) =>
            void update((draft) => {
              draft.tracking.stripTrackingParams = on;
            })
          }
        />
        <SwitchRow
          title="Block tracking pings"
          description="Stops the beacons pages send to report clicks and activity"
          checked={tracking.blockPings}
          onChange={(on) =>
            void update((draft) => {
              draft.tracking.blockPings = on;
            })
          }
        />
        <SwitchRow
          title="Don't tell sites where you came from"
          description="Removes the referrer from requests to other sites. A few image hosts refuse requests without it."
          checked={tracking.stripThirdPartyReferrer}
          onChange={(on) =>
            void update((draft) => {
              draft.tracking.stripThirdPartyReferrer = on;
            })
          }
        />
        <SwitchRow
          title="Send a Global Privacy Control signal"
          description="Tells sites not to sell or share your data. Legally binding in some regions."
          checked={tracking.sendGpc}
          onChange={(on) =>
            void update((draft) => {
              draft.tracking.sendGpc = on;
            })
          }
        />
      </Section>

      <Section title="Customise">
        <EditableList
          title="More parameters to remove"
          description="Added to the built-in list. Names must match exactly."
          items={tracking.extraTrackingParams}
          onChange={(params) =>
            void update((draft) => {
              draft.tracking.extraTrackingParams = params;
            })
          }
          validate={wordValidator(tracking.extraTrackingParams)}
          emptyText="No parameters added"
          noun="a parameter"
          fieldLabel="Parameter name"
          placeholder="ref_id"
        />
        <EditableList
          title="Sites without tracking protection"
          description="For sites that break with these protections, including fingerprinting protection"
          items={tracking.allowedSites}
          onChange={(sites) =>
            void update((draft) => {
              draft.tracking.allowedSites = sites;
            })
          }
          validate={sitePatternValidator(tracking.allowedSites, ['domain'])}
          emptyText="No sites added"
          noun="a site"
          fieldLabel="Site"
          placeholder="example.com"
          helper="Includes the site's subdomains"
          sites
        />
      </Section>
    </>
  );
}
