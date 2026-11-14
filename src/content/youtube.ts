/**
 * YouTube tool. Runs in the extension's isolated world at document_start on YouTube, and is
 * only registered while the tool is switched on.
 *
 * Every option is a stylesheet rule in youtube.css gated by an attribute on <html>, so this
 * script only sets attributes. Changes apply to open tabs immediately.
 */
import { YOUTUBE_OPTIONS, optionAttribute, type YouTubeOption } from '../shared/site-tools';

type Options = Record<YouTubeOption, boolean> & { enabled: boolean };

const root = document.documentElement;
let hideShorts = false;

function apply(stored: unknown): void {
  const saved = (stored as { youtube?: Partial<Options> } | undefined)?.youtube;
  const options: Options = { enabled: false, ...YOUTUBE_OPTIONS, ...saved };
  for (const option of Object.keys(YOUTUBE_OPTIONS) as YouTubeOption[]) {
    root.toggleAttribute(optionAttribute(option), options.enabled && options[option]);
  }
  hideShorts = options.enabled && options.hideShorts;
  leaveShorts();
}

/** Plays a Short as a regular video. Links into Shorts from inside YouTube end up here. */
function leaveShorts(): void {
  const id = hideShorts ? /^\/shorts\/([\w-]+)/.exec(location.pathname)?.[1] : undefined;
  if (id !== undefined) location.replace(`/watch?v=${id}`);
}

// YouTube navigates without reloading and announces each navigation with this event.
document.addEventListener('yt-navigate-finish', leaveShorts);

void chrome.storage.local.get('settings').then(({ settings }) => apply(settings));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) apply(changes.settings.newValue);
});
