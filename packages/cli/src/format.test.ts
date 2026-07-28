import { describe, expect, it } from "vitest";
import { formatEvaluation, formatVerification } from "./format.js";

describe("CLI formatting", () => {
  it("renders a compact decision summary", () => {
    const text = formatEvaluation({
      actionId: "act-1",
      policyId: "policy-1",
      decision: "review",
      riskScore: 42,
      riskSignals: ["external effect"],
      matchedRules: [
        {
          id: "external-review",
          description: "Review external actions.",
          priority: 10,
          effect: "review",
        },
      ],
      approval: { required: 1, roles: ["owner"], expiresInMinutes: 15 },
      reasons: ["REVIEW: Review external actions."],
      evaluatedAt: "2026-07-28T00:00:00.000Z",
    });

    expect(text).toContain("◇ REVIEW");
    expect(text).toContain("42/100");
    expect(text).toContain("1 from owner");
  });

  it("marks failed verification", () => {
    const text = formatVerification({
      valid: false,
      checks: {
        receiptHash: false,
        actionHash: true,
        policyHash: null,
        previousReceiptHash: true,
        evaluation: null,
        approvals: true,
      },
      errors: ["receiptHash check failed"],
    });

    expect(text).toContain("✕ INVALID");
    expect(text).toContain("FAIL  receiptHash");
  });
});
