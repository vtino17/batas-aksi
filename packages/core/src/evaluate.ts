import type {
  ActionEnvelope,
  Decision,
  Effect,
  EvaluationResult,
  PolicyRule,
  RuleCondition,
} from "./types.js";
import { assertAction, assertPolicy } from "./validation.js";

const decisionWeight: Record<Decision, number> = {
  allow: 0,
  review: 1,
  deny: 2,
};

function globMatches(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escaped.replaceAll("*", ".*").replaceAll("?", ".")}$`, "i");
  return regex.test(value);
}

function intersects(left: readonly string[], right: readonly string[]): boolean {
  return left.some((entry) => right.includes(entry));
}

function includesAll(container: readonly string[], values: readonly string[]): boolean {
  return values.every((entry) => container.includes(entry));
}

export function matchesCondition(action: ActionEnvelope, condition: RuleCondition): boolean {
  const toolId = `${action.tool.namespace}/${action.tool.name}`;
  const amount = action.estimatedCost?.amount;

  return (
    (!condition.tools || condition.tools.some((pattern) => globMatches(pattern, toolId))) &&
    (!condition.operations || condition.operations.some((pattern) => globMatches(pattern, action.tool.operation))) &&
    (!condition.targetPatterns || condition.targetPatterns.some((pattern) => globMatches(pattern, action.target.locator))) &&
    (!condition.environments || condition.environments.includes(action.target.environment)) &&
    (!condition.effectsAny || intersects(action.effects, condition.effectsAny)) &&
    (!condition.effectsAll || includesAll(action.effects, condition.effectsAll)) &&
    (!condition.dataClassesAny || intersects(action.dataClasses, condition.dataClassesAny)) &&
    (condition.reversible === undefined || condition.reversible === action.reversible) &&
    (condition.minAmount === undefined || (amount !== undefined && amount >= condition.minAmount)) &&
    (condition.maxAmount === undefined || (amount !== undefined && amount <= condition.maxAmount))
  );
}

export function calculateRisk(action: ActionEnvelope): {
  score: number;
  signals: string[];
} {
  const weights: Record<Effect, number> = {
    read: 5,
    write: 18,
    external: 22,
    financial: 32,
    destructive: 48,
    credential: 38,
  };
  const sensitiveData = new Set(["personal", "pii", "financial", "health", "credential", "secret"]);
  let score = action.effects.reduce((total, effect) => total + weights[effect], 0);
  const signals = action.effects.map((effect) => `${effect} effect`);

  if (action.dataClasses.some((entry) => sensitiveData.has(entry.toLowerCase()))) {
    score += 18;
    signals.push("sensitive data");
  }
  if (!action.reversible) {
    score += 18;
    signals.push("irreversible");
  }
  if (action.target.environment === "production") {
    score += 12;
    signals.push("production target");
  }
  if ((action.estimatedCost?.amount ?? 0) >= 1_000_000) {
    score += 12;
    signals.push("high-value transaction");
  }

  return { score: Math.min(100, score), signals };
}

function approvalFor(rules: PolicyRule[]): EvaluationResult["approval"] {
  const requirements = rules
    .map((rule) => rule.require)
    .filter((requirement) => requirement !== undefined);

  return {
    required: Math.max(0, ...requirements.map((entry) => entry.count)),
    roles: [...new Set(requirements.flatMap((entry) => entry.roles ?? []))].sort(),
    expiresInMinutes:
      requirements.length === 0
        ? null
        : Math.min(...requirements.map((entry) => entry.expiresInMinutes ?? Number.POSITIVE_INFINITY)) ===
            Number.POSITIVE_INFINITY
          ? null
          : Math.min(...requirements.map((entry) => entry.expiresInMinutes ?? Number.POSITIVE_INFINITY)),
  };
}

export function evaluateAction(
  actionValue: unknown,
  policyValue: unknown,
  now = new Date(),
): EvaluationResult {
  assertAction(actionValue);
  assertPolicy(policyValue);
  const action = actionValue;
  const policy = policyValue;

  const matched = policy.rules
    .filter((rule) => matchesCondition(action, rule.when))
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));

  const decision =
    matched.length === 0
      ? policy.defaultDecision
      : matched.reduce<Decision>(
          (current, rule) =>
            decisionWeight[rule.effect] > decisionWeight[current] ? rule.effect : current,
          "allow",
        );
  const controllingRules = matched.filter((rule) => rule.effect === decision);
  const risk = calculateRisk(action);
  const reasons =
    matched.length === 0
      ? [`No rule matched; policy default is ${policy.defaultDecision}.`]
      : controllingRules.map((rule) => `${rule.effect.toUpperCase()}: ${rule.description}`);

  if (action.expiresAt && Date.parse(action.expiresAt) <= now.getTime()) {
    return {
      actionId: action.id,
      policyId: policy.id,
      decision: "deny",
      riskScore: risk.score,
      riskSignals: risk.signals,
      matchedRules: matched,
      approval: { required: 0, roles: [], expiresInMinutes: null },
      reasons: ["DENY: Action envelope has expired."],
      evaluatedAt: now.toISOString(),
    };
  }

  return {
    actionId: action.id,
    policyId: policy.id,
    decision,
    riskScore: risk.score,
    riskSignals: risk.signals,
    matchedRules: matched,
    approval: approvalFor(controllingRules),
    reasons,
    evaluatedAt: now.toISOString(),
  };
}
