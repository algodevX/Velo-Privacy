/** Browser families Velo is built for. Each gets its own build in dist/<target>. */
export const BROWSER_TARGETS = ['chromium', 'firefox', 'safari'] as const;
export type BrowserTarget = (typeof BROWSER_TARGETS)[number];
