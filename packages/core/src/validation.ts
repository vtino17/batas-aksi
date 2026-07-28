import { decisions, effects } from "./types.js";
import type {
  ActionEnvelope,
  ActionPolicy,
  ValidationIssue,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "string" && record[key].trim().length > 0;
}

function issue(path: string, message: string): ValidationIssue {
  return { path, message };
}

export function validateAction(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [issue("$", "Action must be a JSON object.")];
  }

  const issues: ValidationIssue[] = [];
  if (value.schemaVersion !== "1.0") {
    issues.push(issue("schemaVersion", 'Must equal "1.0".'));
  }

  for (const key of ["id", "intent", "requestedAt"]) {
    if (!hasText(value, key)) {
      issues.push(issue(key, "Must be a non-empty string."));
    }
  }

  if (typeof value.requestedAt === "string" && Number.isNaN(Date.parse(value.requestedAt))) {
    issues.push(issue("requestedAt", "Must be a valid ISO-8601 timestamp."));
  }

  if (!isRecord(value.agent)) {
    issues.push(issue("agent", "Must be an object."));
  } else {
    for (const key of ["id", "name", "sessionId"]) {
      if (!hasText(value.agent, key)) {
        issues.push(issue(`agent.${key}`, "Must be a non-empty string."));
      }
    }
  }

  if (!isRecord(value.tool)) {
    issues.push(issue("tool", "Must be an object."));
  } else {
    for (const key of ["namespace", "name", "operation"]) {
      if (!hasText(value.tool, key)) {
        issues.push(issue(`tool.${key}`, "Must be a non-empty string."));
      }
    }
  }

  if (!isRecord(value.target)) {
    issues.push(issue("target", "Must be an object."));
  } else {
    for (const key of ["kind", "locator"]) {
      if (!hasText(value.target, key)) {
        issues.push(issue(`target.${key}`, "Must be a non-empty string."));
      }
    }
    if (!["local", "development", "staging", "production"].includes(String(value.target.environment))) {
      issues.push(issue("target.environment", "Must be local, development, staging, or production."));
    }
  }

  if (
    !Array.isArray(value.effects) ||
    value.effects.length === 0 ||
    value.effects.some((entry) => !effects.includes(entry as (typeof effects)[number]))
  ) {
    issues.push(issue("effects", `Must contain one or more of: ${effects.join(", ")}.`));
  }

  if (!Array.isArray(value.dataClasses) || value.dataClasses.some((entry) => typeof entry !== "string")) {
    issues.push(issue("dataClasses", "Must be an array of strings."));
  }

  if (typeof value.reversible !== "boolean") {
    issues.push(issue("reversible", "Must be a boolean."));
  }

  if (value.estimatedCost !== undefined) {
    if (!isRecord(value.estimatedCost)) {
      issues.push(issue("estimatedCost", "Must be an object."));
    } else {
      if (typeof value.estimatedCost.amount !== "number" || value.estimatedCost.amount < 0) {
        issues.push(issue("estimatedCost.amount", "Must be a non-negative number."));
      }
      if (!hasText(value.estimatedCost, "currency")) {
        issues.push(issue("estimatedCost.currency", "Must be a non-empty string."));
      }
    }
  }

  return issues;
}

export function validatePolicy(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [issue("$", "Policy must be a JSON object.")];
  }

  const issues: ValidationIssue[] = [];
  if (value.policyVersion !== "1.0") {
    issues.push(issue("policyVersion", 'Must equal "1.0".'));
  }
  for (const key of ["id", "name"]) {
    if (!hasText(value, key)) {
      issues.push(issue(key, "Must be a non-empty string."));
    }
  }
  if (!decisions.includes(value.defaultDecision as (typeof decisions)[number])) {
    issues.push(issue("defaultDecision", `Must be one of: ${decisions.join(", ")}.`));
  }
  if (!Array.isArray(value.rules)) {
    issues.push(issue("rules", "Must be an array."));
    return issues;
  }

  const ids = new Set<string>();
  value.rules.forEach((entry, index) => {
    const path = `rules[${index}]`;
    if (!isRecord(entry)) {
      issues.push(issue(path, "Must be an object."));
      return;
    }
    if (!hasText(entry, "id")) {
      issues.push(issue(`${path}.id`, "Must be a non-empty string."));
    } else if (ids.has(String(entry.id))) {
      issues.push(issue(`${path}.id`, "Rule id must be unique."));
    } else {
      ids.add(String(entry.id));
    }
    if (!hasText(entry, "description")) {
      issues.push(issue(`${path}.description`, "Must be a non-empty string."));
    }
    if (!Number.isInteger(entry.priority)) {
      issues.push(issue(`${path}.priority`, "Must be an integer."));
    }
    if (!decisions.includes(entry.effect as (typeof decisions)[number])) {
      issues.push(issue(`${path}.effect`, `Must be one of: ${decisions.join(", ")}.`));
    }
    if (!isRecord(entry.when)) {
      issues.push(issue(`${path}.when`, "Must be an object."));
    }
    if (entry.require !== undefined) {
      if (!isRecord(entry.require)) {
        issues.push(issue(`${path}.require`, "Must be an object."));
      } else if (
        !Number.isInteger(entry.require.count) ||
        Number(entry.require.count) < 1
      ) {
        issues.push(issue(`${path}.require.count`, "Must be an integer of at least 1."));
      }
    }
  });

  return issues;
}

export function assertAction(value: unknown): asserts value is ActionEnvelope {
  const issues = validateAction(value);
  if (issues.length > 0) {
    throw new Error(`Invalid action:\n${issues.map((entry) => `- ${entry.path}: ${entry.message}`).join("\n")}`);
  }
}

export function assertPolicy(value: unknown): asserts value is ActionPolicy {
  const issues = validatePolicy(value);
  if (issues.length > 0) {
    throw new Error(`Invalid policy:\n${issues.map((entry) => `- ${entry.path}: ${entry.message}`).join("\n")}`);
  }
}
