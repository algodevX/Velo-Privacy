import { migrate } from './migrations';
import { SettingsSchema, defaultSettings, type Settings } from './schema';

const STORAGE_KEY = 'settings';

export class SettingsError extends Error {
  override readonly name = 'SettingsError';
}

/**
 * Parses untrusted settings (storage contents or an import file) into a valid configuration.
 * Missing fields take their defaults; invalid ones raise a SettingsError naming the field.
 */
export function parseSettings(raw: unknown): Settings {
  const result = SettingsSchema.safeParse(migrate(raw ?? {}));
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const path = issue?.path.join('.') || 'settings';
  throw new SettingsError(`${path}: ${issue?.message ?? 'invalid value'}`);
}

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  try {
    return parseSettings(stored[STORAGE_KEY]);
  } catch (error) {
    // Never overwrite what is stored: the user can still export and repair it.
    console.error('Stored settings are invalid; using defaults until they are fixed.', error);
    return defaultSettings();
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: SettingsSchema.parse(settings) });
}

/** Applies `mutate` to a copy of the current settings and saves the result. */
export async function updateSettings(mutate: (draft: Settings) => void): Promise<Settings> {
  const draft = structuredClone(await loadSettings());
  mutate(draft);
  await saveSettings(draft);
  return draft;
}

/** Calls `listener` with the new settings whenever they change in any extension context. */
export function onSettingsChanged(listener: (settings: Settings) => void): () => void {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !(STORAGE_KEY in changes)) return;
    try {
      listener(parseSettings(changes[STORAGE_KEY]?.newValue));
    } catch (error) {
      console.error('Ignoring invalid settings update.', error);
    }
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
