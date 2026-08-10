import { describe, expect, it } from "vitest";
import { createReceipt, verifyReceipt } from "./receipt.js";
import { sha256 } from "./canonical.js";
import type { ActionEnvelope, ActionPolicy } from "./types.js";

const action: ActionEnvelope = {
  schemaVersion: "1.0",
  id: "act-email",
  agent: { id: "agent-1", name: "Mail agent", sessionId: "session-1" },
  intent: "Send a customer update",
  tool: { namespace: "google", name: "gmail", operation: "send_email" },
  target: { kind: "email", locator: "customer@example.test", environment: "production" },
  effects: ["external", "write"],
  dataClasses: ["personal"],
  reversible: false,
  requestedAt: "2026-07-28T02:00:00.000Z",
};

const policy: ActionPolicy = {
  policyVersion: "1.0",
  id: "policy-email",
  name: "Email guard",
  defaultDecision: "review",
  rules: [
    {
      id: "review-external-email",
      description: "External messages need a communications owner.",
      priority: 50,
      effect: "review",
      when: { tools: ["google/gmail"], operations: ["send_*"] },
      require: { count: 1, roles: ["communications-owner"], expiresInMinutes: 15 },
    },
  ],
};

describe("receipts", () => {
  it("creates and verifies a receipt tied to action and policy content", async () => {
    const receipt = await createReceipt({
      action,
      policy,
      approvals: [
        {
          approver: "Ayu",
          role: "communications-owner",
          approvedAt: "2026-07-28T02:01:00.000Z",
        },
      ],
      now: new Date("2026-07-28T02:02:00.000Z"),
    });
    const verification = await verifyReceipt({ receipt, action, policy });

    expect(verification.valid).toBe(true);
    expect(receipt.receiptHash).toHaveLength(64);
    expect(verification.checks.evaluation).toBe(true);
  });

  it("detects mutation", async () => {
    const receipt = await createReceipt({
      action,
      policy,
      approvals: [
        {
          approver: "Ayu",
          role: "communications-owner",
          approvedAt: "2026-07-28T02:01:00.000Z",
        },
      ],
      now: new Date("2026-07-28T02:02:00.000Z"),
    });
    const verification = await verifyReceipt({
      receipt: { ...receipt, riskScore: 0 },
      action,
      policy,
    });

    expect(verification.valid).toBe(false);
    expect(verification.checks.receiptHash).toBe(false);
  });

  it("refuses under-approved review decisions", async () => {
    await expect(createReceipt({ action, policy })).rejects.toThrow("requires 1 distinct approval");
  });

  it("rejects a rehashed receipt containing an expired approval", async () => {
    const receipt = await createReceipt({
      action,
      policy,
      approvals: [{
        approver: "Ayu",
        role: "communications-owner",
        approvedAt: "2026-07-28T02:01:00.000Z",
      }],
      now: new Date("2026-07-28T02:02:00.000Z"),
    });
    receipt.approvals[0]!.approvedAt = "2026-07-28T01:00:00.000Z";
    const payload = { ...receipt, receiptHash: undefined };
    receipt.receiptHash = await sha256(payload);

    const verification = await verifyReceipt({ receipt, action, policy });
    expect(verification.checks.receiptHash).toBe(true);
    expect(verification.checks.approvals).toBe(false);
    expect(verification.valid).toBe(false);
  });
});
