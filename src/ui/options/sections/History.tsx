import { useState } from 'preact/hooks';
import { send } from '../../../shared/messages';
import { detectCapabilities } from '../../../shared/platform';
import { Button, Select } from '../../components/controls';
import { Row, Section, SwitchRow } from '../../components/layout';
import { EditableList, sitePatternValidator, wordValidator } from '../../components/lists';
import { plural } from '../../labels';
import type { SectionProps } from '../section';

const RETENTION_OPTIONS = [
  { value: 'forever', label: 'Until you delete it' },
  { value: '1', label: '1 day' },
  { value: '7', label: '1 week' },
  { value: '30', label: '1 month' },
  { value: '90', label: '3 months' },
  { value: '365', label: '1 year' },
] as const;

type Retention = (typeof RETENTION_OPTIONS)[number]['value'];

const canEraseDownloads = detectCapabilities().downloads;

export function HistorySection({ settings, update }: SectionProps) {
  const { history } = settings;
  const [purgeStatus, setPurgeStatus] = useState<string>();

  const retention = String(history.retentionDays ?? 'forever');
  const known = RETENTION_OPTIONS.find((option) => option.value === retention);

  const purge = async () => {
    setPurgeStatus('Removing…');
    const { removed } = await send({ type: 'purge-history' });
    setPurgeStatus(`Removed ${plural(removed, 'entry', 'entries')}`);
  };

  return (
    <>
      <Section title="History">
        <SwitchRow
          title="Record history"
          description="When off, new visits are removed as they happen. Existing history is kept."
          checked={history.record}
          onChange={(record) =>
            void update((draft) => {
              draft.history.record = record;
            })
          }
        />
        <Row title="Keep history" description="Older entries are deleted automatically">
          <Select<Retention>
            label="Keep history"
            value={known?.value ?? 'forever'}
            options={RETENTION_OPTIONS}
            onChange={(value) =>
              void update((draft) => {
                draft.history.retentionDays = value === 'forever' ? null : Number(value);
              })
            }
          />
        </Row>
        {canEraseDownloads && (
          <SwitchRow
            title="Remove finished downloads from the list"
            description="Downloaded files stay on your device"
            checked={history.eraseDownloads}
            onChange={(erase) =>
              void update((draft) => {
                draft.history.eraseDownloads = erase;
              })
            }
          />
        )}
      </Section>

      <Section title="Pages never kept in history">
        <EditableList
          title="Sites"
          description="Every visit to a matching site is removed"
          items={history.excludedSites}
          onChange={(sites) =>
            void update((draft) => {
              draft.history.excludedSites = sites;
            })
          }
          validate={sitePatternValidator(history.excludedSites)}
          emptyText="No sites added"
          noun="a site"
          fieldLabel="Site"
          placeholder="example.com"
          helper={
            <>
              Also accepts <code>*.example.com</code>, <code>google.*</code> and{' '}
              <code>/regular expressions/</code>
            </>
          }
          sites
        />
        <EditableList
          title="Keywords"
          description="Pages whose address or title contains a keyword, ignoring case"
          items={history.excludedKeywords}
          onChange={(keywords) =>
            void update((draft) => {
              draft.history.excludedKeywords = keywords;
            })
          }
          validate={wordValidator(history.excludedKeywords)}
          emptyText="No keywords added"
          noun="a keyword"
          fieldLabel="Keyword"
        />
        <Row
          title="Apply to existing history"
          description={purgeStatus ?? 'Removes matching entries recorded before you added them'}
        >
          <Button onClick={() => void purge()}>Remove matches</Button>
        </Row>
      </Section>
    </>
  );
}
