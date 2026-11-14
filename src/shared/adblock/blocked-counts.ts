import type { RuleSpec } from '../dnr';
import { FILTER_LISTS, type FilterIndex } from './catalog';

/**
 * Counting what was blocked on a page, by kind.
 *
 * The browser reports which rules matched in a tab, but not what they did. Rulesets
 * therefore number their blocking rules first (see `blocksFirst`), and the filter index
 * records how many there are, so a rule id tells whether a request was blocked.
 */

export interface BlockedCounts {
  ads: number;
  trackers: number;
}

export interface MatchedRule {
  ruleId: number;
  /** A static ruleset's id, or `_dynamic` / `_session`. */
  rulesetId: string;
}

export const isBlockRule = (rule: RuleSpec): boolean => rule.action.type === 'block';

/** `rules` with blocking rules first, otherwise in their original order. */
export function blocksFirst<T extends RuleSpec>(rules: readonly T[]): T[] {
  return [...rules.filter(isBlockRule), ...rules.filter((rule) => !isBlockRule(rule))];
}

/** Ids of dynamic rules that block requests, by what they block. */
export interface DynamicBlocks {
  ads: ReadonlySet<number>;
  trackers: ReadonlySet<number>;
}

const DYNAMIC = '_dynamic';

/**
 * Sorts matched rules into ads and trackers: the privacy lists and tracking protection
 * block trackers; every other list and the user's own filters block ads.
 */
export function countBlocked(
  matched: readonly MatchedRule[],
  index: FilterIndex,
  dynamic: DynamicBlocks,
): BlockedCounts {
  const blockRules = new Map(index.lists.map((list) => [list.id, list.blockRules]));
  const privacyLists = new Set(
    FILTER_LISTS.filter((list) => list.category === 'privacy').map((list) => list.id),
  );
  const counts: BlockedCounts = { ads: 0, trackers: 0 };
  for (const { ruleId, rulesetId } of matched) {
    if (rulesetId === DYNAMIC) {
      if (dynamic.ads.has(ruleId)) counts.ads++;
      else if (dynamic.trackers.has(ruleId)) counts.trackers++;
      continue;
    }
    if (ruleId > (blockRules.get(rulesetId) ?? 0)) continue;
    if (privacyLists.has(rulesetId)) counts.trackers++;
    else counts.ads++;
  }
  return counts;
}

/** Sorts dynamic rules that block requests by the module that owns their id range. */
export function dynamicBlocks(
  rules: readonly (RuleSpec & { id: number })[],
  ranges: Record<'adblock' | 'tracking', { first: number; last: number }>,
): DynamicBlocks {
  const inRange = (id: number, range: { first: number; last: number }) =>
    id >= range.first && id <= range.last;
  const blocking = rules.filter(isBlockRule);
  return {
    ads: new Set(blocking.filter((r) => inRange(r.id, ranges.adblock)).map((r) => r.id)),
    trackers: new Set(blocking.filter((r) => inRange(r.id, ranges.tracking)).map((r) => r.id)),
  };
}
