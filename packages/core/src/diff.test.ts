import { describe, expect, it } from "vitest";
import { diffPolicies } from "./diff.js";
import type { ActionPolicy } from "./types.js";

const base: ActionPolicy = {
  policyVersion: "1.0",
  id: "v1",
  name: "Policy v1",
  defaultDecision: "review",
  rules: [
    {
      id: "protect-delete",
      description: "Protect deletions.",
      priority: 100,
      effect: "deny",
      when: { effectsAny: ["destructive"] },
    },
  ],
};

describe("diffPolicies", () => {
  it("flags weakened controls", () => {
    const result = diffPolicies(base, {
      ...base,
      id: "v2",
      defaultDecision: "allow",
      rules: [{ ...base.rules[0]!, effect: "review" }],
    });

    expect(result.weakenedControls).toHaveLength(2);
    expect(result.modified).toEqual(["protect-delete"]);
  });
});
