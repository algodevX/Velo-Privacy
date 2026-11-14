import { useCallback, useEffect, useState } from 'preact/hooks';
import type { Settings } from '../shared/settings/schema';
import { loadSettings, onSettingsChanged, updateSettings } from '../shared/settings/store';

export type UpdateSettings = (mutate: (draft: Settings) => void) => Promise<void>;

/** Live settings: re-renders whenever settings change in any extension context. */
export function useSettings(): [Settings | undefined, UpdateSettings] {
  const [settings, setSettings] = useState<Settings>();

  useEffect(() => {
    void loadSettings().then(setSettings);
    return onSettingsChanged(setSettings);
  }, []);

  const update = useCallback<UpdateSettings>(async (mutate) => {
    setSettings(await updateSettings(mutate));
  }, []);

  return [settings, update];
}

/** The active tab of the current window, read once. */
export function useActiveTab(): chrome.tabs.Tab | null | undefined {
  const [tab, setTab] = useState<chrome.tabs.Tab | null>();
  useEffect(() => {
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([active]) => setTab(active ?? null));
  }, []);
  return tab;
}

/** The key assigned to an extension command, which people can change in the browser. */
export function useShortcut(command: string): string | undefined {
  const [shortcut, setShortcut] = useState<string>();
  useEffect(() => {
    void chrome.commands
      .getAll()
      .then((commands) => setShortcut(commands.find((c) => c.name === command)?.shortcut ?? ''));
  }, [command]);
  return shortcut;
}
