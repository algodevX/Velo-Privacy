import { RULE_ID_RANGES, type RuleSpec } from '../shared/dnr';
import { serialized } from './serial';

export type RuleScope = keyof typeof RULE_ID_RANGES;

/** Atomically replaces every dynamic rule in `scope` with `specs`. */
export const installRules = serialized(async (scope: RuleScope, specs: readonly RuleSpec[]) => {
  const { first, last } = RULE_ID_RANGES[scope];
  if (specs.length > last - first + 1) {
    throw new RangeError(`${scope}: ${specs.length} rules exceed the ${last - first + 1} reserved`);
  }
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.filter((rule) => rule.id >= first && rule.id <= last).map((r) => r.id),
    // RuleSpec mirrors chrome.declarativeNetRequest.Rule using string literals in place of
    // the runtime enums; see shared/dnr.ts.
    addRules: specs.map((spec, index) => ({
      id: first + index,
      ...spec,
    })) as chrome.declarativeNetRequest.Rule[],
  });
});
