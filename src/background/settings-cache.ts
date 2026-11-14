import { loadSettings } from '../shared/settings/store';
import type { Settings } from '../shared/settings/schema';

let cached: Promise<Settings> | undefined;

/** The latest settings, read from storage at most once per service-worker lifetime. */
export function currentSettings(): Promise<Settings> {
  cached ??= loadSettings();
  return cached;
}

export function updateCachedSettings(settings: Settings): void {
  cached = Promise.resolve(settings);
}
