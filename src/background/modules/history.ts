import {
  compileHistoryPolicy,
  judgeHistoryEntry,
  type HistoryPolicy,
} from '../../shared/history-policy';
import type { Capabilities } from '../../shared/platform';
import type { Settings } from '../../shared/settings/schema';
import type { Module } from '../module';
import { currentSettings } from '../settings-cache';

const RETENTION_ALARM = 'history-retention';
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Keeps history clean.
 *
 * Chromium offers no way to stop a visit from being recorded, so visits are removed the
 * moment they are reported. Site and keyword exclusions remove the URL entirely, since its
 * stored title would otherwise survive in older visits. Pausing history removes only the
 * new visit and leaves earlier history alone.
 */
export function createHistoryModule(capabilities: Capabilities): Module {
  let compiled: { source: Settings['history']; policy: HistoryPolicy } | undefined;

  const policy = async (): Promise<HistoryPolicy> => {
    const { history } = await currentSettings();
    if (compiled?.source !== history) {
      compiled = { source: history, policy: compileHistoryPolicy(history) };
    }
    return compiled.policy;
  };

  const onVisited = async ({ url, title, lastVisitTime }: chrome.history.HistoryItem) => {
    if (url === undefined) return;
    const verdict = judgeHistoryEntry(await policy(), url, title);
    if (verdict.keep) return;
    if (verdict.reason === 'paused' && lastVisitTime !== undefined) {
      await chrome.history.deleteRange({ startTime: lastVisitTime, endTime: lastVisitTime + 1 });
    } else {
      await chrome.history.deleteUrl({ url });
    }
  };

  /** Titles often arrive after the visit was recorded, so keywords are checked again. */
  const onTitleChanged = async (url: string, title: string) => {
    const current = await policy();
    if (current.keywords.length === 0) return;
    const verdict = judgeHistoryEntry(current, url, title);
    if (!verdict.keep && verdict.reason !== 'paused') await chrome.history.deleteUrl({ url });
  };

  const enforceRetention = async () => {
    const { history } = await currentSettings();
    if (history.retentionDays === null) return;
    await chrome.history.deleteRange({
      startTime: 0,
      endTime: Date.now() - history.retentionDays * DAY_MS,
    });
  };

  return {
    name: 'history',
    sections: ['history'],

    listen() {
      chrome.history.onVisited.addListener((item) => void onVisited(item));
      chrome.tabs.onUpdated.addListener((_tabId, change, tab) => {
        if (change.title !== undefined && tab.url !== undefined && !tab.incognito) {
          void onTitleChanged(tab.url, change.title);
        }
      });
      if (capabilities.downloads) {
        chrome.downloads.onChanged.addListener(({ id, state }) => {
          if (state?.current !== 'complete' && state?.current !== 'interrupted') return;
          void (async () => {
            const { history } = await currentSettings();
            if (history.eraseDownloads) await chrome.downloads.erase({ id });
          })();
        });
      }
      chrome.alarms.onAlarm.addListener(({ name }) => {
        if (name === RETENTION_ALARM) void enforceRetention();
      });
    },

    async apply({ history }) {
      if (history.retentionDays === null) {
        await chrome.alarms.clear(RETENTION_ALARM);
      } else {
        await chrome.alarms.create(RETENTION_ALARM, { delayInMinutes: 1, periodInMinutes: 60 });
      }
    },
  };
}

/** Removes every existing history entry that the current rules exclude. */
export async function purgeExcludedHistory(history: Settings['history']): Promise<number> {
  const policy = compileHistoryPolicy({ ...history, record: true });
  const items = await chrome.history.search({ text: '', startTime: 0, maxResults: 1_000_000 });
  const urls = items.flatMap((item) =>
    item.url !== undefined && !judgeHistoryEntry(policy, item.url, item.title).keep
      ? [item.url]
      : [],
  );
  await Promise.all(urls.map((url) => chrome.history.deleteUrl({ url })));
  return urls.length;
}
