import { useState } from 'preact/hooks';
import { hashPassword } from '../../../shared/password';
import { WHATSAPP_AUTO_LOCK_MINUTES, type WhatsAppOption } from '../../../shared/site-tools';
import { Button, Select, TextField } from '../../components/controls';
import { MasterSwitch, Row, Section, SwitchRow } from '../../components/layout';
import { Dialog } from '../../components/overlays';
import { ShortcutRow } from '../../components/shortcut';
import type { SectionProps } from '../section';

const BLUR_OPTIONS: readonly { option: WhatsAppOption; title: string; description?: string }[] = [
  { option: 'blurMessages', title: 'Messages', description: 'The text of the open chat' },
  { option: 'blurMedia', title: 'Photos and videos', description: 'Media in the open chat' },
  { option: 'blurPreviews', title: 'Last message previews', description: 'In the chat list' },
  { option: 'blurNames', title: 'Names', description: 'Of contacts and groups' },
  { option: 'blurAvatars', title: 'Profile pictures' },
  { option: 'blurInput', title: 'What you’re typing' },
];

const NEVER = 'never';
const AUTO_LOCK_OPTIONS = [
  { value: NEVER, label: 'Never' },
  ...WHATSAPP_AUTO_LOCK_MINUTES.map((minutes) => ({
    value: String(minutes),
    label: minutes < 60 ? `After ${minutes} min` : 'After 1 hour',
  })),
];

export function WhatsAppSection({ settings, update }: SectionProps) {
  const { whatsapp } = settings;
  const [settingPassword, setSettingPassword] = useState(false);
  const off = !whatsapp.enabled;
  const noPassword = whatsapp.password === null;
  const set = (option: WhatsAppOption) => (on: boolean) =>
    void update((draft) => {
      draft.whatsapp[option] = on;
    });

  return (
    <>
      <MasterSwitch
        icon="chat"
        title="WhatsApp Web privacy"
        description="Blur your chats and lock WhatsApp Web with a password. Nothing runs on WhatsApp while this is off."
        checked={whatsapp.enabled}
        onChange={(on) =>
          void update((draft) => {
            draft.whatsapp.enabled = on;
          })
        }
      />

      <Section
        title="Blur"
        description="Keeps your chats unreadable to people nearby. Changes apply to open tabs right away."
      >
        {BLUR_OPTIONS.map(({ option, title, description }) => (
          <SwitchRow
            key={option}
            title={title}
            description={description}
            checked={whatsapp[option]}
            disabled={off}
            onChange={set(option)}
          />
        ))}
        <SwitchRow
          icon="visibility_off"
          title="Show on hover"
          description="Point at a chat or message to read it"
          checked={whatsapp.revealOnHover}
          disabled={off}
          onChange={set('revealOnHover')}
        />
      </Section>

      <Section
        title="Lock screen"
        description="Covers WhatsApp Web until you enter your password. It keeps chats out of sight; it isn't encryption."
      >
        <Row
          icon="lock"
          title="Password"
          description={noPassword ? 'Set a password to use the lock screen' : 'Set'}
        >
          <Button disabled={off} onClick={() => setSettingPassword(true)}>
            {noPassword ? 'Set password' : 'Change'}
          </Button>
        </Row>
        <SwitchRow
          title="Lock when WhatsApp opens"
          checked={whatsapp.lockOnOpen}
          disabled={off || noPassword}
          onChange={set('lockOnOpen')}
        />
        <Row title="Lock automatically" description="When you haven't used WhatsApp for a while">
          <Select
            label="Lock automatically"
            value={whatsapp.autoLockMinutes === null ? NEVER : String(whatsapp.autoLockMinutes)}
            options={AUTO_LOCK_OPTIONS}
            disabled={off || noPassword}
            onChange={(value) =>
              void update((draft) => {
                draft.whatsapp.autoLockMinutes = value === NEVER ? null : Number(value);
              })
            }
          />
        </Row>
      </Section>

      <Section title="Keyboard shortcuts">
        <ShortcutRow command="whatsapp-lock" title="Lock now" />
        <ShortcutRow command="whatsapp-toggle-blur" title="Show or blur everything" />
      </Section>

      <PasswordDialog
        open={settingPassword}
        onClose={() => setSettingPassword(false)}
        onSave={async (password) => {
          const hash = await hashPassword(password);
          await update((draft) => {
            draft.whatsapp.password = hash;
          });
          setSettingPassword(false);
        }}
      />
    </>
  );
}

const MIN_PASSWORD_LENGTH = 4;

interface PasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (password: string) => Promise<void>;
}

function PasswordDialog({ open, onClose, onSave }: PasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const tooShort = password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirmation !== '' && confirmation !== password;

  const close = () => {
    setPassword('');
    setConfirmation('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      title="Lock screen password"
      onClose={close}
      submitLabel="Save"
      submitDisabled={tooShort || confirmation !== password || saving}
      onSubmit={() => {
        setSaving(true);
        void onSave(password).finally(() => {
          setSaving(false);
          setPassword('');
          setConfirmation('');
        });
      }}
    >
      <p>Only a hash of the password is stored. If you forget it, set a new one here.</p>
      <TextField
        type="password"
        autocomplete="new-password"
        label="Password"
        value={password}
        onInput={setPassword}
        helper={`At least ${MIN_PASSWORD_LENGTH} characters`}
        autofocus
      />
      <TextField
        type="password"
        autocomplete="new-password"
        label="Confirm password"
        value={confirmation}
        onInput={setConfirmation}
        error={mismatch ? 'The passwords don’t match' : null}
      />
    </Dialog>
  );
}
