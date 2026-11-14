import { SEARCH_ENGINES } from '../../../shared/search/engines';
import { LANGUAGES, REGIONS } from '../../../shared/search/regions';
import { Select } from '../../components/controls';
import { SiteIcon } from '../../components/Icon';
import { Row, Section, SwitchRow } from '../../components/layout';
import { SAFE_SEARCH_OPTIONS } from '../../labels';
import type { SectionProps } from '../section';

const UNSET = 'unset';

export function SearchSection({ settings, update }: SectionProps) {
  const { search } = settings;

  return (
    <>
      <Section title="Private searching">
        <SwitchRow
          title="Isolate searches"
          description="Searches are sent without cookies, so engines can't link them to you or to each other. Your browser history is unaffected."
          checked={search.isolate}
          onChange={(isolate) =>
            void update((draft) => {
              draft.search.isolate = isolate;
            })
          }
        />
        <SwitchRow
          title="Remember your cookie banner answer"
          description="Keeps only the cookie that records your consent choice, so the banner doesn't return on every search"
          checked={search.preserveConsent}
          disabled={!search.isolate}
          onChange={(preserve) =>
            void update((draft) => {
              draft.search.preserveConsent = preserve;
            })
          }
        />
      </Section>

      <Section title="Search preferences">
        <Row
          title="Applied to every search"
          description="Engines that don't support a preference ignore it"
        />
        <Row title="Region">
          <Select
            label="Region"
            value={search.region ?? UNSET}
            options={[
              { value: UNSET, label: 'Engine default' },
              ...REGIONS.map((region) => ({ value: region.id, label: region.name })),
            ]}
            onChange={(value) =>
              void update((draft) => {
                draft.search.region = value === UNSET ? null : value;
              })
            }
          />
        </Row>
        <Row title="Language">
          <Select
            label="Language"
            value={search.language ?? UNSET}
            options={[
              { value: UNSET, label: "Region's language" },
              ...LANGUAGES.map((language) => ({ value: language.id, label: language.name })),
            ]}
            onChange={(value) =>
              void update((draft) => {
                draft.search.language = value === UNSET ? null : value;
              })
            }
          />
        </Row>
        <Row title="SafeSearch">
          <Select
            label="SafeSearch"
            value={search.safeSearch ?? UNSET}
            options={SAFE_SEARCH_OPTIONS}
            onChange={(value) =>
              void update((draft) => {
                draft.search.safeSearch = value === UNSET ? null : value;
              })
            }
          />
        </Row>
        <SwitchRow
          title="Show only web results on Google"
          description="Opens Google's Web view: links without AI overviews or widgets"
          checked={search.webResultsOnly}
          onChange={(webOnly) =>
            void update((draft) => {
              draft.search.webResultsOnly = webOnly;
            })
          }
        />
      </Section>

      <Section title="Search engines">
        <Row
          title="Velo applies the settings above on these engines"
          description="Turn one off to leave it alone"
        />
        {SEARCH_ENGINES.map((engine) => (
          <SwitchRow
            key={engine.id}
            leading={<SiteIcon host={engine.hosts[0] ?? null} />}
            title={engine.name}
            checked={!search.disabledEngines.includes(engine.id)}
            onChange={(on) =>
              void update((draft) => {
                const others = draft.search.disabledEngines.filter((id) => id !== engine.id);
                draft.search.disabledEngines = on ? others : [...others, engine.id];
              })
            }
          />
        ))}
      </Section>
    </>
  );
}
