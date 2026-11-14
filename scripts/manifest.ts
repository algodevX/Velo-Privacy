/**
 * Generates manifest.json for each browser target.
 *
 * One Manifest V3 extension runs everywhere, but browsers disagree on how the background
 * script is declared and on which permissions exist. Requesting a permission a browser
 * does not know only produces a warning, but leaving it out keeps install prompts honest.
 * Features behind missing APIs are switched off at runtime (src/shared/platform.ts).
 */
import { FILTER_LISTS, rulesetPath } from '../src/shared/adblock/catalog';
import type { BrowserTarget } from '../src/shared/target';

/** Firefox add-on id. Replace with your own before publishing on addons.mozilla.org. */
const GECKO_ID = '{aaf37512-5e69-466b-ba1c-013ff72e0429}';

const PERMISSIONS = [
  // Lets the popup read what was blocked in the current tab, and nothing else.
  'activeTab',
  'alarms',
  'browsingData',
  'contentSettings',
  'cookies',
  'declarativeNetRequest',
  'downloads',
  'favicon',
  'history',
  'privacy',
  'scripting',
  'storage',
  'tabs',
  'webNavigation',
];

/** Permissions each browser does not implement. */
const UNSUPPORTED_PERMISSIONS: Record<BrowserTarget, readonly string[]> = {
  chromium: [],
  firefox: ['contentSettings', 'favicon'],
  safari: ['browsingData', 'contentSettings', 'downloads', 'favicon', 'history', 'privacy'],
};

const ICONS = { 16: 'icons/16.png', 32: 'icons/32.png', 48: 'icons/48.png', 128: 'icons/128.png' };

export function createManifest(target: BrowserTarget, version: string): Record<string, unknown> {
  return {
    manifest_version: 3,
    name: 'Velo Privacy',
    description:
      'Blocks ads, trackers and fingerprinting, and controls what sites and your browser remember about you.',
    version,
    homepage_url: 'https://github.com/algodevX/Velo-Privacy',
    icons: ICONS,
    action: {
      default_title: 'Velo Privacy',
      default_popup: 'popup.html',
      default_icon: { 16: ICONS[16], 32: ICONS[32] },
    },
    options_ui: { page: 'options.html', open_in_tab: true },
    background:
      target === 'firefox' ? { scripts: ['background.js'] } : { service_worker: 'background.js' },
    commands: {
      'toggle-picture-in-picture': {
        description: 'Toggle picture-in-picture for the current video',
        suggested_key: { default: 'Alt+P' },
      },
      panic: {
        description: 'Panic button: hide all tabs, or bring them back',
        suggested_key: { default: 'Alt+Shift+H' },
      },
      'whatsapp-lock': {
        description: 'Lock WhatsApp Web',
        suggested_key: { default: 'Alt+Shift+L' },
      },
      'whatsapp-toggle-blur': {
        description: 'Show or blur chats in WhatsApp Web',
        suggested_key: { default: 'Alt+Shift+B' },
      },
    },
    permissions: PERMISSIONS.filter((p) => !UNSUPPORTED_PERMISSIONS[target].includes(p)),
    // Asked for only when the panic button is switched on. Safari has no bookmarks API.
    ...(target !== 'safari' && { optional_permissions: ['bookmarks'] }),
    host_permissions: ['<all_urls>'],
    declarative_net_request: {
      rule_resources: FILTER_LISTS.map((list) => ({
        id: list.id,
        enabled: list.enabledByDefault,
        path: rulesetPath(list.id),
      })),
    },
    ...(target === 'chromium' && { minimum_chrome_version: '123', incognito: 'spanning' }),
    ...(target === 'firefox' && {
      browser_specific_settings: { gecko: { id: GECKO_ID, strict_min_version: '128.0' } },
    }),
  };
}
