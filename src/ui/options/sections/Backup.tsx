import { useRef, useState } from 'preact/hooks';
import { defaultSettings } from '../../../shared/settings/schema';
import { parseSettings, saveSettings } from '../../../shared/settings/store';
import { Button } from '../../components/controls';
import { Notice, Row, Section } from '../../components/layout';
import { Dialog } from '../../components/overlays';
import type { SectionProps } from '../section';

interface Status {
  kind: 'info' | 'error';
  text: string;
}

export function BackupSection({ settings }: SectionProps) {
  const [status, setStatus] = useState<Status>();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportSettings = () => {
    const blob = new Blob([`${JSON.stringify(settings, null, 2)}\n`], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `velo-privacy-settings-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importSettings = async (file: File) => {
    try {
      await saveSettings(parseSettings(JSON.parse(await file.text())));
      setStatus({ kind: 'info', text: `Settings imported from ${file.name}` });
    } catch (error) {
      setStatus({
        kind: 'error',
        text: `Couldn't import ${file.name}: ${(error as Error).message}`,
      });
    }
  };

  const reset = async () => {
    setConfirmingReset(false);
    await saveSettings(defaultSettings());
    setStatus({ kind: 'info', text: 'Settings were reset to their defaults' });
  };

  return (
    <>
      <Section title="Backup">
        {status && <Notice kind={status.kind}>{status.text}</Notice>}
        <Row title="Export settings" description="Saves every setting and list to a file">
          <Button onClick={exportSettings}>Export</Button>
        </Row>
        <Row
          title="Import settings"
          description="Replaces your current settings with the ones in a file you exported"
        >
          <Button onClick={() => fileInput.current?.click()}>Import</Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) void importSettings(file);
            }}
          />
        </Row>
      </Section>

      <Section title="Reset">
        <Row
          title="Restore settings to their original defaults"
          description="Your site lists, keywords and filters are deleted too"
        >
          <Button onClick={() => setConfirmingReset(true)}>Reset</Button>
        </Row>
      </Section>

      <Dialog
        open={confirmingReset}
        title="Reset settings?"
        submitLabel="Reset settings"
        danger
        onSubmit={() => void reset()}
        onClose={() => setConfirmingReset(false)}
      >
        <p>
          Every Velo setting returns to its default, and all your site lists, keywords and filters
          are deleted. Export your settings first if you might want them back.
        </p>
      </Dialog>
    </>
  );
}
