import { canonicalJson } from "./canonical.js";
import type { ActionPolicy, Decision, PolicyDiff, PolicyRule } from "./types.js";
import { assertPolicy } from "./validation.js";

const decisionWeight: Record<Decision, number> = {
  allow: 0,
  review: 1,
  deny: 2,
};

function ruleMap(policy: ActionPolicy): Map<string, PolicyRule> {
  return new Map(policy.rules.map((rule) => [rule.id, rule]));
}

export function diffPolicies(fromValue: unknown, toValue: unknown): PolicyDiff {
  assertPolicy(fromValue);
  assertPolicy(toValue);
  const from = fromValue;
  const to = toValue;
  const oldRules = ruleMap(from);
  const newRules = ruleMap(to);
  const added = [...newRules.keys()].filter((id) => !oldRules.has(id)).sort();
  const removed = [...oldRules.keys()].filter((id) => !newRules.has(id)).sort();
  const modified = [...oldRules.keys()]
    .filter((id) => newRules.has(id) && canonicalJson(oldRules.get(id)) !== canonicalJson(newRules.get(id)))
    .sort();
  const weakenedControls: string[] = [];

  if (decisionWeight[to.defaultDecision] < decisionWeight[from.defaultDecision]) {
    weakenedControls.push(
      `Default decision weakened from ${from.defaultDecision} to ${to.defaultDecision}.`,
    );
  }
  for (const id of removed) {
    const oldRule = oldRules.get(id);
    if (oldRule && oldRule.effect !== "allow") {
      weakenedControls.push(`Protective rule "${id}" was removed.`);
    }
  }
  for (const id of modified) {
    const oldRule = oldRules.get(id);
    const newRule = newRules.get(id);
    if (oldRule && newRule && decisionWeight[newRule.effect] < decisionWeight[oldRule.effect]) {
      weakenedControls.push(
        `Rule "${id}" weakened from ${oldRule.effect} to ${newRule.effect}.`,
      );
    }
    if (
      oldRule?.require &&
      (!newRule?.require || newRule.require.count < oldRule.require.count)
    ) {
      weakenedControls.push(`Rule "${id}" requires fewer approvals.`);
    }
  }

  return {
    from: from.id,
    to: to.id,
    defaultDecisionChanged: from.defaultDecision !== to.defaultDecision,
    added,
    removed,
    modified,
    weakenedControls,
  };
}
