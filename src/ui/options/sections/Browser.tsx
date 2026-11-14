import { detectCapabilities, hasPrivacySetting } from '../../../shared/platform';
import { Select } from '../../components/controls';
import { Row, Section, SwitchRow } from '../../components/layout';
import { EditableList, sitePatternValidator } from '../../components/lists';
import { WEBRTC_OPTIONS } from '../../labels';
import type { SectionProps } from '../section';

const capabilities = detectCapabilities();

export function BrowserSection({ settings, update }: SectionProps) {
  const { https } = settings;
  return (
    <>
      <Section
        title="Secure connections"
        description="Pages loaded over plain HTTP can be read and changed by anyone on your network."
      >
        <SwitchRow
          icon="encrypted"
          title="Always use HTTPS"
          description="Loads every page over an encrypted connection. Sites without HTTPS won't open until you add them below. Local addresses such as routers are left alone."
          checked={https.upgrade}
          onChange={(on) =>
            void update((draft) => {
              draft.https.upgrade = on;
            })
          }
        />
        <EditableList
          title="Sites allowed over HTTP"
          items={https.exceptions}
          onChange={(sites) =>
            void update((draft) => {
              draft.https.exceptions = sites;
            })
          }
          validate={sitePatternValidator(https.exceptions, ['domain'])}
          emptyText="No sites added"
          noun="a site"
          fieldLabel="Site"
          placeholder="example.com"
          helper="Includes the site's subdomains"
          sites
          disabled={!https.upgrade}
        />
      </Section>
      {capabilities.privacy && <BrowserPreferences settings={settings} update={update} />}
    </>
  );
}

/** Browser-wide preferences. Only those the running browser has are shown. */
function BrowserPreferences({ settings, update }: Omit<SectionProps, 'subpage'>) {
  const { browser } = settings;
  return (
    <Section title="Browser privacy settings">
      <Row
        title="Velo manages these settings for you"
        description="Turning one off gives control back to your browser's own setting"
      />
      {hasPrivacySetting('websites', 'thirdPartyCookiesAllowed') && (
        <SwitchRow
          title="Block third-party cookies"
          description="Companies embedded in the sites you visit can't store cookies"
          checked={browser.blockThirdPartyCookies}
          onChange={(on) =>
            void update((draft) => {
              draft.browser.blockThirdPartyCookies = on;
            })
          }
        />
      )}
      {hasPrivacySetting('websites', 'topicsEnabled') && (
        <SwitchRow
          title="Turn off ad measurement in the browser"
          description="Disables Topics, Protected Audience and Attribution Reporting"
          checked={browser.disableAdPrivacyApis}
          onChange={(on) =>
            void update((draft) => {
              draft.browser.disableAdPrivacyApis = on;
            })
          }
        />
      )}
      {hasPrivacySetting('websites', 'hyperlinkAuditingEnabled') && (
        <SwitchRow
          title="Turn off hyperlink auditing"
          description="Sites aren't notified when you follow their links"
          checked={browser.disableHyperlinkAuditing}
          onChange={(on) =>
            void update((draft) => {
              draft.browser.disableHyperlinkAuditing = on;
            })
          }
        />
      )}
      {hasPrivacySetting('network', 'networkPredictionEnabled') && (
        <SwitchRow
          title="Turn off preloading"
          description="Pages aren't fetched before you open them. Browsing gets slightly slower."
          checked={browser.disablePreloading}
          onChange={(on) =>
            void update((draft) => {
              draft.browser.disablePreloading = on;
            })
          }
        />
      )}
      {hasPrivacySetting('services', 'searchSuggestEnabled') && (
        <SwitchRow
          title="Turn off address bar suggestions"
          description="What you type isn't sent to your search engine until you press Enter"
          checked={browser.disableSearchSuggestions}
          onChange={(on) =>
            void update((draft) => {
              draft.browser.disableSearchSuggestions = on;
            })
          }
        />
      )}
      {hasPrivacySetting('network', 'webRTCIPHandlingPolicy') && (
        <Row
          title="IP address for calls"
          description="Limits which addresses video calls and peer-to-peer apps (WebRTC) can reveal. Through proxy only breaks calls without a proxy or VPN."
        >
          <Select
            label="IP address for calls"
            value={browser.webRtcPolicy}
            options={WEBRTC_OPTIONS}
            onChange={(policy) =>
              void update((draft) => {
                draft.browser.webRtcPolicy = policy;
              })
            }
          />
        </Row>
      )}
    </Section>
  );
}
