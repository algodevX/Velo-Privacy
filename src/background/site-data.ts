import { hostnameOf } from '../shared/domains';
import { siteOf } from '../shared/sites';
import { detectCapabilities } from '../shared/platform';

export interface ForgetResult {
  readonly cookiesRemoved: number;
  readonly historyRemoved: number;
}

const STORAGE_TYPES: chrome.browsingData.DataTypeSet = {
  localStorage: true,
  indexedDB: true,
  cacheStorage: true,
  serviceWorkers: true,
  fileSystems: true,
  cache: true,
};

/** Firefox filters browsingData by hostname rather than by origin, for fewer data types. */
interface HostnameRemovalOptions extends chrome.browsingData.RemovalOptions {
  hostnames: string[];
}
const HOSTNAME_STORAGE_TYPES: chrome.browsingData.DataTypeSet = {
  localStorage: true,
  indexedDB: true,
  serviceWorkers: true,
};

const capabilities = detectCapabilities();

/**
 * Deletes what the browser keeps for `site` (a registrable domain): its cookies, the
 * storage and cache of every known origin on it, and optionally its history.
 */
export async function forgetSite(
  site: string,
  options: { origins?: readonly string[]; history: boolean },
): Promise<ForgetResult> {
  const cookiesRemoved = await removeHostCookies([site]);
  await clearStorage([`https://${site}`, `https://www.${site}`, ...(options.origins ?? [])]);
  const historyRemoved = options.history ? await deleteSiteHistory(site) : 0;
  return { cookiesRemoved, historyRemoved };
}

/** Removes site storage and cache, but not cookies, for the given origins. */
export async function clearStorage(origins: readonly string[]): Promise<void> {
  const unique = [...new Set(origins)];
  if (!capabilities.browsingData || unique.length === 0) return;
  try {
    await chrome.browsingData.remove({ origins: unique as [string, ...string[]] }, STORAGE_TYPES);
  } catch {
    const hostnames = [...new Set(unique.flatMap((o) => hostnameOf(o) ?? []))];
    const options: HostnameRemovalOptions = { hostnames };
    await chrome.browsingData.remove(options, HOSTNAME_STORAGE_TYPES).catch((error: unknown) => {
      console.warn('Site storage could not be removed', error);
    });
  }
}

/**
 * Removes cookies set for these hosts or their subdomains, including partitioned ones.
 * Sibling hosts on the same registrable domain keep theirs.
 */
export async function removeHostCookies(hosts: readonly string[]): Promise<number> {
  let removed = 0;
  for (const host of hosts) {
    for (const cookie of await chrome.cookies.getAll({ domain: host })) {
      await removeCookie(cookie);
      removed += 1;
    }
  }
  return removed;
}

export async function removeCookie(cookie: chrome.cookies.Cookie): Promise<void> {
  const host = cookie.domain.replace(/^\./, '');
  await chrome.cookies.remove({
    url: `${cookie.secure ? 'https' : 'http'}://${host}${cookie.path}`,
    name: cookie.name,
    storeId: cookie.storeId,
    ...(cookie.partitionKey && { partitionKey: cookie.partitionKey }),
  });
}

async function deleteSiteHistory(site: string): Promise<number> {
  if (!capabilities.history) return 0;
  const items = await chrome.history.search({ text: site, startTime: 0, maxResults: 100_000 });
  const urls = items.flatMap((item) =>
    item.url !== undefined && siteOf(item.url) === site ? [item.url] : [],
  );
  await Promise.all(urls.map((url) => chrome.history.deleteUrl({ url })));
  return urls.length;
}
