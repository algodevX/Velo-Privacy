import { SETTINGS_VERSION } from './schema';

type RawSettings = Record<string, unknown>;

/**
 * Upgrades stored settings one version at a time. `MIGRATIONS[n]` turns version n into
 * version n + 1. Settings without a version are treated as the current version, which
 * lets hand-written import files omit it.
 */
const MIGRATIONS: Readonly<Record<number, (settings: RawSettings) => RawSettings>> = {};

export function migrate(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  let settings = raw;
  let version = typeof settings.version === 'number' ? settings.version : SETTINGS_VERSION;
  if (version > SETTINGS_VERSION) {
    throw new Error(
      `These settings come from a newer version of Velo (format ${version}). Update Velo first.`,
    );
  }
  while (version < SETTINGS_VERSION) {
    const step = MIGRATIONS[version];
    if (step === undefined) throw new Error(`No migration from settings format ${version}`);
    settings = step(settings);
    version += 1;
  }
  return { ...settings, version };
}

function isRecord(value: unknown): value is RawSettings {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
