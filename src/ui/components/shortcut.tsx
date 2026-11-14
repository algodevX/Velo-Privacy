import { detectCapabilities } from '../../shared/platform';
import { useShortcut } from '../hooks';
import { Button } from './controls';
import { Row } from './layout';

const capabilities = detectCapabilities();

interface ShortcutRowProps {
  command: string;
  title: string;
  description?: string;
}

/** The key assigned to an extension command, with a way to change it. */
export function ShortcutRow({ command, title, description }: ShortcutRowProps) {
  const shortcut = useShortcut(command);
  return (
    <Row
      icon="keyboard"
      title={title}
      description={
        description ??
        (capabilities.chromium
          ? undefined
          : 'Change it in your browser’s extension shortcut settings')
      }
    >
      {shortcut === '' ? 'Not set' : shortcut && <kbd>{shortcut}</kbd>}
      {capabilities.chromium && (
        <Button
          variant="text"
          onClick={() => void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
        >
          Change
        </Button>
      )}
    </Row>
  );
}
