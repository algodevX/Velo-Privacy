import { describe, expect, it } from 'vitest';
import { PRESETS, activePreset, applyPreset } from '../src/shared/settings/presets';
import { SETTINGS_VERSION, defaultSettings } from '../src/shared/settings/schema';
import { SettingsError, parseSettings } from '../src/shared/settings/store';

describe('parseSettings', () => {
  it('fills in defaults for missing sections and fields', () => {
    const settings = parseSettings({ history: { record: false } });
    expect(settings.version).toBe(SETTINGS_VERSION);
    expect(settings.history.record).toBe(false);
    expect(settings.history.excludedSites).toEqual([]);
    expect(settings.cookies).toEqual(defaultSettings().cookies);
  });

  it('names the offending field', () => {
    expect(() => parseSettings({ cookies: { defaultAction: 'sometimes' } })).toThrow(SettingsError);
    expect(() => parseSettings({ cookies: { defaultAction: 'sometimes' } })).toThrow(
      /cookies\.defaultAction/,
    );
  });

  it('refuses settings from a newer version', () => {
    expect(() => parseSettings({ version: SETTINGS_VERSION + 1 })).toThrow(/newer version/);
  });

  it('round-trips through JSON', () => {
    const settings = defaultSettings();
    expect(parseSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings);
  });
});

describe('presets', () => {
  it('starts on the Balanced preset', () => {
    expect(activePreset(defaultSettings())?.id).toBe('balanced');
  });

  it('switches presets without touching site lists', () => {
    const settings = defaultSettings();
    settings.cookies.rules.push({ pattern: 'example.com', action: 'allow' });
    const strict = PRESETS.find((p) => p.id === 'strict');
    if (!strict) throw new Error('missing preset');
    applyPreset(settings, strict);
    expect(activePreset(settings)?.id).toBe('strict');
    expect(settings.cookies.rules).toHaveLength(1);
  });

  it('reports no preset once a switch is changed by hand', () => {
    const settings = defaultSettings();
    settings.tracking.blockPings = false;
    expect(activePreset(settings)).toBeUndefined();
  });
});
