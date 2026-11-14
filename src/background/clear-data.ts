import type { ClearDataRequest } from '../shared/messages';
import { detectCapabilities } from '../shared/platform';

const capabilities = detectCapabilities();

/** Deletes browsing data across all sites, like the browser's own "Clear browsing data". */
export async function clearBrowsingData(request: ClearDataRequest): Promise<void> {
  const siteData = request.siteData;
  await chrome.browsingData.remove(
    { since: request.since },
    {
      history: request.history,
      downloads: request.downloads,
      cache: request.cache,
      cookies: siteData,
      localStorage: siteData,
      indexedDB: siteData,
      serviceWorkers: siteData,
      // Storage types only Chromium names separately.
      ...(capabilities.chromium && {
        cacheStorage: siteData,
        fileSystems: siteData,
        webSQL: siteData,
      }),
    },
  );
}
