import { useEffect, useState } from 'preact/hooks';
import { PANIC_STASH_KEY, readPanicStash, type PanicStash } from '../../../shared/panic';
import { detectCapabilities } from '../../../shared/platform';
import { openBrowserClearData, useClearData } from '../../components/clear-data';
import { Button } from '../../components/controls';
import { Notice, Row, Section, SwitchRow } from '../../components/layout';
import { Dialog } from '../../components/overlays';
import { ShortcutRow } from '../../components/shortcut';
import { plural } from '../../labels';
import { setPanicEnabled } from '../../panic';
import type { SectionProps } from '../section';

const capabilities = detectCapabilities();

export function CleanupSection({ settings, update }: SectionProps) {
  return (
    <>
      {capabilities.bookmarks && (
        <Section
          title="Panic button"
          description="Saves every open tab to a bookmark folder and closes them, leaving one new tab. Press it again to reopen them and delete the folder. Private windows are left alone."
        >
          <SwitchRow
            icon="emergency_home"
            title="Panic button"
            description="Shows the button at the top of the toolbar popup and turns on its shortcut. Your browser asks to let Velo use bookmarks."
            checked={settings.panic.enabled}
            onChange={(on) => void setPanicEnabled(update, on)}
          />
          <ShortcutRow command="panic" title="Keyboard shortcut" />
          <PanicStatus />
        </Section>
      )}
      {capabilities.browsingData && <ClearData />}
    </>
  );
}

function PanicStatus() {
  const [stash, setStash] = useState<PanicStash | null>(null);
  useEffect(() => {
    void readPanicStash().then(setStash);
    const onChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (PANIC_STASH_KEY in changes) void readPanicStash().then(setStash);
    };
    chrome.storage.local.onChanged.addListener(onChange);
    return () => chrome.storage.local.onChanged.removeListener(onChange);
  }, []);
  if (stash === null) return null;
  return (
    <Notice>
      {plural(stash.tabs, 'tab is', 'tabs are')} hidden. Press the panic button again to bring them
      back.
    </Notice>
  );
}

function ClearData() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const { fields, nothingChosen, clear } = useClearData();
  return (
    <Section
      title="Clear browsing data"
      description="Deletes data across all sites. To delete one site's data, use the toolbar popup on that site."
    >
      <Row
        icon="cleaning_services"
        title="Delete browsing data"
        description={done ? 'Done' : undefined}
      >
        <Button
          onClick={() => {
            setDone(false);
            setOpen(true);
          }}
        >
          Delete…
        </Button>
      </Row>
      {openBrowserClearData && (
        <Row
          icon="open_in_new"
          title="Your browser’s own page"
          description="For passwords, autofill and other data only the browser can delete"
        >
          <Button variant="text" onClick={openBrowserClearData}>
            Open
          </Button>
        </Row>
      )}
      <Dialog
        open={open}
        title="Delete browsing data"
        onClose={() => setOpen(false)}
        submitLabel="Delete data"
        submitDisabled={nothingChosen}
        danger
        onSubmit={() =>
          void clear().then(() => {
            setOpen(false);
            setDone(true);
          })
        }
      >
        {fields}
      </Dialog>
    </Section>
  );
}
