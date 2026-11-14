import { ICONS, type IconName } from '../icons';

interface IconProps {
  name: IconName;
  size?: number;
  class?: string;
}

/** A decorative Material Symbols icon, drawn in the current text colour. */
export function Icon({ name, size = 20, class: className }: IconProps) {
  return (
    <svg
      class={className === undefined ? 'icon' : `icon ${className}`}
      viewBox="0 -960 960 960"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

const canShowFavicons = chrome.runtime.getManifest().permissions?.includes('favicon') ?? false;

/**
 * The browser's cached icon for a site, read locally without contacting the site.
 * Browsers without a favicon API, and patterns that are not plain hosts, get a globe.
 */
export function SiteIcon({ host }: { host: string | null }) {
  if (host === null || !canShowFavicons) return <Icon name="public" class="site-icon" />;
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', `https://${host}/`);
  url.searchParams.set('size', '32');
  return <img class="site-icon" src={url.href} alt="" width={20} height={20} />;
}
