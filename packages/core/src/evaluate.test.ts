import { describe, expect, it } from "vitest";
import { evaluateAction } from "./evaluate.js";
import type { ActionEnvelope, ActionPolicy } from "./types.js";

const action: ActionEnvelope = {
  schemaVersion: "1.0",
  id: "act-001",
  agent: { id: "agent-1", name: "Ops agent", sessionId: "session-1" },
  intent: "Remove stale production records",
  tool: { namespace: "database", name: "postgres", operation: "delete_rows" },
  target: { kind: "database", locator: "prod/customer", environment: "production" },
  effects: ["write", "destructive"],
  dataClasses: ["personal"],
  reversible: false,
  requestedAt: "2026-07-28T02:00:00.000Z",
};

const policy: ActionPolicy = {
  policyVersion: "1.0",
  id: "policy-1",
  name: "Default",
  defaultDecision: "review",
  rules: [
    {
      id: "deny-prod-delete",
      description: "Production deletion is prohibited.",
      priority: 100,
      effect: "deny",
      when: {
        environments: ["production"],
        effectsAny: ["destructive"],
      },
    },
    {
      id: "review-write",
      description: "Writes need review.",
      priority: 50,
      effect: "review",
      when: { effectsAny: ["write"] },
      require: { count: 1, roles: ["owner"] },
    },
  ],
};

describe("evaluateAction", () => {
  it("uses deny-overrides semantics and reports every matching rule", () => {
    const result = evaluateAction(action, policy, new Date("2026-07-28T02:01:00.000Z"));

    expect(result.decision).toBe("deny");
    expect(result.matchedRules.map((rule) => rule.id)).toEqual([
      "deny-prod-delete",
      "review-write",
    ]);
    expect(result.riskScore).toBe(100);
    expect(result.approval.required).toBe(0);
  });

  it("fails closed when an envelope is expired", () => {
    const result = evaluateAction(
      { ...action, expiresAt: "2026-07-28T01:59:00.000Z" },
      { ...policy, rules: [] },
      new Date("2026-07-28T02:01:00.000Z"),
    );

    expect(result.decision).toBe("deny");
    expect(result.reasons[0]).toContain("expired");
  });

  it("rejects structurally invalid input", () => {
    expect(() => evaluateAction({ id: "broken" }, policy)).toThrow("Invalid action");
  });
});
