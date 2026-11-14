import { describe, expect, it } from 'vitest';
import { blocksFirst, countBlocked, dynamicBlocks } from '../src/shared/adblock/blocked-counts';
import type { FilterIndex } from '../src/shared/adblock/catalog';
import { RULE_ID_RANGES, type RuleSpec } from '../src/shared/dnr';

const block: RuleSpec = { priority: 10, action: { type: 'block' }, condition: {} };
const allow: RuleSpec = { priority: 20, action: { type: 'allow' }, condition: {} };

const index: FilterIndex = {
  builtAt: '',
  lists: [
    { id: 'easylist', rules: 10, blockRules: 8, genericSelectors: 0, specificSelectors: 0 },
    { id: 'easyprivacy', rules: 5, blockRules: 5, genericSelectors: 0, specificSelectors: 0 },
  ],
};

describe('blocksFirst', () => {
  it('moves blocking rules ahead of the rest, keeping their order', () => {
    const a = { ...block, priority: 1 };
    const b = { ...block, priority: 2 };
    expect(blocksFirst([allow, a, allow, b])).toEqual([a, b, allow, allow]);
  });
});

describe('countBlocked', () => {
  it('counts privacy lists and tracking rules as trackers, the rest as ads', () => {
    const dynamic = dynamicBlocks(
      [
        { id: 1_000, ...block },
        { id: 1_001, ...allow },
        { id: 10_000, ...block },
      ],
      RULE_ID_RANGES,
    );
    const counts = countBlocked(
      [
        { rulesetId: 'easylist', ruleId: 3 },
        { rulesetId: 'easylist', ruleId: 9 }, // an exception, not a block
        { rulesetId: 'easyprivacy', ruleId: 2 },
        { rulesetId: '_dynamic', ruleId: 1_000 },
        { rulesetId: '_dynamic', ruleId: 1_001 },
        { rulesetId: '_dynamic', ruleId: 10_000 },
      ],
      index,
      dynamic,
    );
    expect(counts).toEqual({ ads: 2, trackers: 2 });
  });
});
