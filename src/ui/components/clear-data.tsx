import { useState } from 'preact/hooks';
import type { ClearDataRequest } from '../../shared/messages';
import { send } from '../../shared/messages';
import { detectCapabilities } from '../../shared/platform';
import { Select } from './controls';

const capabilities = detectCapabilities();

const HOUR = 60 * 60 * 1000;
const RANGES = [
  { value: 'hour', label: 'Last hour', duration: HOUR },
  { value: 'day', label: 'Last 24 hours', duration: 24 * HOUR },
  { value: 'week', label: 'Last 7 days', duration: 7 * 24 * HOUR },
  { value: 'month', label: 'Last 4 weeks', duration: 28 * 24 * HOUR },
  { value: 'all', label: 'All time', duration: Infinity },
] as const;

type Range = (typeof RANGES)[number]['value'];
type DataType = Exclude<keyof ClearDataRequest, 'since'>;

const DATA_TYPES: readonly { type: DataType; label: string; available: boolean }[] = [
  { type: 'history', label: 'Browsing history', available: capabilities.history },
  { type: 'siteData', label: 'Cookies and other site data', available: true },
  { type: 'cache', label: 'Cached images and files', available: true },
  { type: 'downloads', label: 'Download history', available: capabilities.downloads },
];

/** Choices for deleting browsing data, as in the browser's own dialog. */
export function useClearData() {
  const [range, setRange] = useState<Range>('hour');
  const [types, setTypes] = useState<Record<DataType, boolean>>({
    history: capabilities.history,
    siteData: true,
    cache: true,
    downloads: false,
  });

  const fields = (
    <>
      <Select
        label="Time range"
        value={range}
        options={RANGES}
        onChange={(value) => setRange(value)}
      />
      <div class="checks">
        {DATA_TYPES.filter((entry) => entry.available).map(({ type, label }) => (
          <label class="check" key={type}>
            <input
              type="checkbox"
              class="checkbox"
              checked={types[type]}
              onChange={(event) => setTypes({ ...types, [type]: event.currentTarget.checked })}
            />
            {label}
          </label>
        ))}
      </div>
    </>
  );

  const nothingChosen = !Object.values(types).some(Boolean);
  const clear = async () => {
    const duration = RANGES.find((entry) => entry.value === range)?.duration ?? HOUR;
    await send({
      type: 'clear-browsing-data',
      since: duration === Infinity ? 0 : Date.now() - duration,
      ...types,
    });
  };

  return { fields, nothingChosen, clear };
}

/** Opens the browser's own "Clear browsing data" page, where there is one to open. */
export const openBrowserClearData = capabilities.chromium
  ? () => void chrome.tabs.create({ url: 'chrome://settings/clearBrowserData' })
  : null;
