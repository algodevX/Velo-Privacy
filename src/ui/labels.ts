import type { CookieAction, SafeSearch, WebRtcPolicy } from '../shared/settings/schema';
import type { Option } from './components/controls';
import type { RadioOption } from './components/layout';

/** What each cookie action is called where a site's action is picked from a menu. */
export const COOKIE_ACTION_LABELS: Record<CookieAction, string> = {
  allow: 'Allow',
  session: 'Clear on exit',
  tab: 'Clear when tabs close',
  block: 'Block',
};

export const COOKIE_ACTIONS: readonly CookieAction[] = ['allow', 'session', 'tab', 'block'];

export const DEFAULT_COOKIE_OPTIONS: readonly RadioOption<CookieAction>[] = [
  {
    value: 'allow',
    label: 'Keep site data',
    description: 'Sites remember you, as they do without Velo',
  },
  {
    value: 'session',
    label: 'Delete site data when you close the browser',
    description: "You stay signed in until you quit, then it's as if you never visited",
  },
  {
    value: 'tab',
    label: "Delete site data when you close a site's tabs",
    description: 'Each site forgets you as soon as you leave it. Allow the sites you sign in to.',
  },
  {
    value: 'block',
    label: "Don't allow sites to save data",
    description: "Most sites work, but sign-ins and saved preferences don't",
  },
];

export const SAFE_SEARCH_OPTIONS: readonly Option<SafeSearch | 'unset'>[] = [
  { value: 'unset', label: 'Engine default' },
  { value: 'off', label: 'Off' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'strict', label: 'Strict' },
];

export const WEBRTC_OPTIONS: readonly Option<WebRtcPolicy>[] = [
  { value: 'default', label: 'Browser default' },
  { value: 'public_interface', label: 'Public address only' },
  { value: 'proxied_only', label: 'Through proxy only' },
];

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : pluralForm}`;
}
