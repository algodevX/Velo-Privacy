/**
 * Builds the extension for each browser into dist/<target>.
 *
 *   npm run build                         all targets
 *   npm run build -- --target=firefox     one target
 *   npm run build -- --refresh-filters    re-download filter lists even if cached
 *   npm run dev                           Chromium build that rebuilds on change
 *
 * Every script is bundled into a single classic script, which every browser accepts as a
 * background worker, extension page script or content script.
 */
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Resvg } from '@resvg/resvg-js';
import * as esbuild from 'esbuild';
import { BROWSER_TARGETS, type BrowserTarget } from '../src/shared/target';
import { compileFilterLists, writeFilterLists } from './filter-lists';
import { createManifest } from './manifest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const ICON_SIZES = [16, 32, 48, 128];
const PAGES = ['popup', 'options'];
/** Stylesheets injected into sites by the site tools, copied as they are. */
const CONTENT_STYLES = ['youtube', 'whatsapp'];

const { values: args } = parseArgs({
  options: {
    target: { type: 'string' },
    watch: { type: 'boolean', default: false },
    'refresh-filters': { type: 'boolean', default: false },
  },
});

async function main(): Promise<void> {
  const targets = args.target === undefined ? BROWSER_TARGETS : [parseTarget(args.target)];
  if (args.watch && targets.length > 1) throw new Error('--watch needs a single --target');
  for (const target of targets) await build(target);
}

async function build(target: BrowserTarget): Promise<void> {
  const outDir = join(root, 'dist', target);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(join(outDir, 'icons'), { recursive: true });

  const lists = await compileFilterLists({
    target,
    cacheDir: join(root, '.cache', 'filter-lists'),
    refresh: args['refresh-filters'],
  });
  await Promise.all([
    writeManifest(target, outDir),
    writeIcons(outDir),
    copyPages(outDir),
    writeFilterLists(outDir, lists),
  ]);

  const context = await esbuild.context({
    bundle: true,
    format: 'iife',
    target: ['chrome123', 'firefox128', 'safari17'],
    legalComments: 'none',
    sourcemap: args.watch ? 'inline' : false,
    minify: !args.watch,
    logLevel: 'warning',
    jsx: 'automatic',
    jsxImportSource: 'preact',
    outdir: outDir,
    entryPoints: {
      background: join(src, 'background/index.ts'),
      popup: join(src, 'ui/popup/main.tsx'),
      options: join(src, 'ui/options/main.tsx'),
      'content/cosmetic': join(src, 'content/cosmetic.ts'),
      'content/fingerprint': join(src, 'content/fingerprint.ts'),
      'content/whatsapp': join(src, 'content/whatsapp.ts'),
      'content/youtube': join(src, 'content/youtube.ts'),
      'content/gpc': join(src, 'content/gpc.ts'),
      'content/pip-unlock': join(src, 'content/pip-unlock.ts'),
    },
  });

  if (args.watch) {
    await context.watch();
    console.log(`Watching ${target}. Reload the extension after each rebuild.`);
    return;
  }
  await context.rebuild();
  await context.dispose();

  const rules = lists.reduce((sum, { result }) => sum + result.stats.rules, 0);
  console.log(`Built dist/${target}: ${lists.length} filter lists, ${rules} rules.`);
}

async function writeManifest(target: BrowserTarget, outDir: string): Promise<void> {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { version: string };
  const manifest = createManifest(target, pkg.version);
  await writeFile(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function writeIcons(outDir: string): Promise<void> {
  const svg = await readFile(join(root, 'assets/icon.svg'));
  await Promise.all(
    ICON_SIZES.map((size) => {
      const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
      return writeFile(join(outDir, 'icons', `${size}.png`), png);
    }),
  );
}

async function copyPages(outDir: string): Promise<void> {
  await mkdir(join(outDir, 'content'), { recursive: true });
  await Promise.all([
    ...PAGES.map((page) =>
      copyFile(join(src, 'ui', page, `${page}.html`), join(outDir, `${page}.html`)),
    ),
    ...CONTENT_STYLES.map((name) =>
      copyFile(join(src, 'content', `${name}.css`), join(outDir, 'content', `${name}.css`)),
    ),
  ]);
}

function parseTarget(value: string): BrowserTarget {
  const target = BROWSER_TARGETS.find((t) => t === value);
  if (target === undefined)
    throw new Error(`Unknown target "${value}". Use one of: ${BROWSER_TARGETS.join(', ')}`);
  return target;
}

await main();
