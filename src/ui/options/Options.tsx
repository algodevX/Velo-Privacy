import type { FunctionComponent } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { detectCapabilities, type Capabilities } from '../../shared/platform';
import { Icon } from '../components/Icon';
import { useSettings } from '../hooks';
import type { IconName } from '../icons';
import type { SectionProps } from './section';
import { AdblockSection } from './sections/Adblock';
import { BackupSection } from './sections/Backup';
import { BrowserSection } from './sections/Browser';
import { CleanupSection } from './sections/Cleanup';
import { CookiesSection } from './sections/Cookies';
import { HistorySection } from './sections/History';
import { MediaSection } from './sections/Media';
import { OverviewSection } from './sections/Overview';
import { SearchSection } from './sections/Search';
import { TrackingSection } from './sections/Tracking';
import { WhatsAppSection } from './sections/WhatsApp';
import { YouTubeSection } from './sections/YouTube';

interface Page {
  id: string;
  title: string;
  description?: string;
  icon: IconName;
  component: FunctionComponent<SectionProps>;
  /** Pages for browser APIs that are missing are not shown at all. */
  available?: (capabilities: Capabilities) => boolean;
}

interface Group {
  heading?: string;
  pages: readonly Page[];
}

const GROUPS: readonly Group[] = [
  {
    pages: [
      {
        id: 'overview',
        title: 'Overview',
        icon: 'space_dashboard',
        component: OverviewSection,
      },
    ],
  },
  {
    heading: 'Protection',
    pages: [
      {
        id: 'adblock',
        title: 'Ad blocking',
        description:
          'Blocks ads and the space they leave behind, using the filter lists you choose.',
        icon: 'block',
        component: AdblockSection,
      },
      {
        id: 'tracking',
        title: 'Tracking',
        description: 'Stops sites from following you between pages and recognising your device.',
        icon: 'fingerprint',
        component: TrackingSection,
      },
      {
        id: 'cookies',
        title: 'Cookies and site data',
        description: 'Decide how long sites may remember you.',
        icon: 'cookie',
        component: CookiesSection,
      },
      {
        id: 'history',
        title: 'History',
        description: 'Choose what your browser keeps in its history.',
        icon: 'history',
        component: HistorySection,
        available: (c) => c.history,
      },
      {
        id: 'search',
        title: 'Search',
        description: 'Search without being recognised, with your own region and filters.',
        icon: 'search',
        component: SearchSection,
      },
      {
        id: 'browser',
        title: 'Browser and security',
        description: 'Secure connections and the privacy settings built into your browser.',
        icon: 'encrypted',
        component: BrowserSection,
      },
    ],
  },
  {
    heading: 'Site tools',
    pages: [
      {
        id: 'youtube',
        title: 'YouTube',
        icon: 'smart_display',
        component: YouTubeSection,
      },
      {
        id: 'whatsapp',
        title: 'WhatsApp Web',
        icon: 'chat',
        component: WhatsAppSection,
      },
      {
        id: 'media',
        title: 'Picture-in-picture',
        description: 'Watch any video in a floating window.',
        icon: 'picture_in_picture_alt',
        component: MediaSection,
      },
    ],
  },
  {
    heading: 'Tools',
    pages: [
      {
        id: 'cleanup',
        title: 'Panic button and cleanup',
        description: 'Hide everything at once, or delete what your browser has kept.',
        icon: 'emergency_home',
        component: CleanupSection,
      },
      {
        id: 'backup',
        title: 'Backup and reset',
        icon: 'settings_backup_restore',
        component: BackupSection,
      },
    ],
  },
];

const capabilities = detectCapabilities();
const VISIBLE_GROUPS = GROUPS.map((group) => ({
  ...group,
  pages: group.pages.filter((page) => page.available?.(capabilities) ?? true),
}));
const PAGES = VISIBLE_GROUPS.flatMap((group) => group.pages);

interface Route {
  page: Page;
  subpage: string | undefined;
}

function routeFromHash(): Route {
  const [id, subpage] = location.hash.slice(1).split('/');
  const page = PAGES.find((p) => p.id === id) ?? (PAGES[0] as Page);
  return { page, subpage: page.id === id ? subpage : undefined };
}

export function Options() {
  const [settings, update] = useSettings();
  const [route, setRoute] = useState(routeFromHash);
  const { page, subpage } = route;

  useEffect(() => {
    const onHashChange = () => {
      setRoute(routeFromHash());
      scrollTo(0, 0);
    };
    addEventListener('hashchange', onHashChange);
    return () => removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.title = `${page.title} – Velo Privacy`;
  }, [page]);

  const Section = page.component;
  return (
    <div class="layout">
      <aside class="drawer">
        <div class="brand">
          <img src="icons/32.png" alt="" width={32} height={32} />
          <span class="brand-name">Velo Privacy</span>
        </div>
        <nav aria-label="Settings">
          {VISIBLE_GROUPS.map((group) => (
            <>
              {group.heading && <div class="nav-heading">{group.heading}</div>}
              <ul class="nav-group">
                {group.pages.map((entry) => (
                  <li key={entry.id}>
                    <a
                      class="nav-item"
                      href={`#${entry.id}`}
                      aria-current={entry.id === page.id ? 'page' : undefined}
                    >
                      <Icon name={entry.icon} size={24} />
                      {entry.title}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ))}
        </nav>
      </aside>
      <main class="page">
        {page.id !== 'overview' && (
          <header class="page-header">
            <div>
              <h1 class="page-title">{page.title}</h1>
              {page.description && <p class="page-description">{page.description}</p>}
            </div>
          </header>
        )}
        {settings && <Section settings={settings} update={update} subpage={subpage} />}
      </main>
    </div>
  );
}
