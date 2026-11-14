/**
 * Downloads the bundled filter lists and compiles them into declarativeNetRequest
 * rulesets and element-hiding data for one browser target.
 *
 * Downloads are cached in .cache/filter-lists for a day. If a download fails, the cached
 * copy is used regardless of age, so builds keep working offline.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  FILTER_INDEX_PATH,
  FILTER_LISTS,
  cosmeticDataPath,
  rulesetPath,
  type FilterIndex,
  type FilterListInfo,
} from '../src/shared/adblock/catalog';
import { blocksFirst, isBlockRule } from '../src/shared/adblock/blocked-counts';
import { partitionGeneric, type CosmeticFile } from '../src/shared/adblock/cosmetic-index';
import type { Rule } from '../src/shared/dnr';
import { compileFilterList, type CompileResult } from '../src/shared/filters/compile';
import { filterEnvironment, preprocess } from '../src/shared/filters/preprocess';
import type { BrowserTarget } from '../src/shared/target';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_INCLUDE_DEPTH = 4;

export interface CompiledList {
  readonly list: FilterListInfo;
  readonly result: CompileResult;
}

export async function compileFilterLists(options: {
  target: BrowserTarget;
  cacheDir: string;
  refresh: boolean;
}): Promise<CompiledList[]> {
  const env = filterEnvironment(options.target);
  const compiled = await Promise.all(
    FILTER_LISTS.map(async (list) => {
      const lines = await loadList(list.url, env, options, 0);
      return { list, result: compileFilterList(lines) };
    }),
  );
  return compiled;
}

/** Writes rulesets, element-hiding data and the index into `outDir`. */
export async function writeFilterLists(
  outDir: string,
  compiled: readonly CompiledList[],
): Promise<void> {
  await mkdir(join(outDir, 'filters'), { recursive: true });
  await Promise.all(
    compiled.flatMap(({ list, result }) => {
      const rules: Rule[] = blocksFirst(result.rules).map((rule, index) => ({
        id: index + 1,
        ...rule,
      }));
      const cosmetic: CosmeticFile = {
        ...result.cosmetic,
        generic: partitionGeneric(result.cosmetic.generic),
      };
      return [
        writeFile(join(outDir, rulesetPath(list.id)), JSON.stringify(rules)),
        writeFile(join(outDir, cosmeticDataPath(list.id)), JSON.stringify(cosmetic)),
      ];
    }),
  );
  const index: FilterIndex = {
    builtAt: new Date().toISOString(),
    lists: compiled.map(({ list, result }) => ({
      id: list.id,
      rules: result.stats.rules,
      blockRules: result.rules.filter(isBlockRule).length,
      genericSelectors: result.stats.genericSelectors,
      specificSelectors: result.stats.specificSelectors,
    })),
  };
  await writeFile(join(outDir, FILTER_INDEX_PATH), JSON.stringify(index, null, 2));
}

async function loadList(
  url: string,
  env: ReadonlySet<string>,
  options: { cacheDir: string; refresh: boolean },
  depth: number,
): Promise<string[]> {
  const lines = preprocess(await download(url, options), env);
  const result: string[] = [];
  for (const line of lines) {
    if (!line.startsWith('!#include ')) {
      result.push(line);
      continue;
    }
    // Like uBlock Origin, only follow includes that stay next to the including list.
    const target = new URL(line.slice('!#include '.length).trim(), url);
    const sameDirectory = target.href.startsWith(new URL('.', url).href);
    if (!sameDirectory || depth >= MAX_INCLUDE_DEPTH) {
      throw new Error(`Refusing to include ${target.href} from ${url}`);
    }
    result.push(...(await loadList(target.href, env, options, depth + 1)));
  }
  return result;
}

async function download(
  url: string,
  { cacheDir, refresh }: { cacheDir: string; refresh: boolean },
) {
  await mkdir(cacheDir, { recursive: true });
  const cacheFile = join(cacheDir, url.replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]+/gi, '_'));
  const cached = await stat(cacheFile).catch(() => undefined);
  if (cached && !refresh && Date.now() - cached.mtimeMs < MAX_AGE_MS)
    return readFile(cacheFile, 'utf8');

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    await writeFile(cacheFile, text);
    return text;
  } catch (error) {
    if (cached) {
      console.warn(`Could not refresh ${url} (${(error as Error).message}); using cached copy.`);
      return readFile(cacheFile, 'utf8');
    }
    throw new Error(`Could not download ${url}: ${(error as Error).message}`, { cause: error });
  }
}
