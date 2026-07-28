import { canonicalJson, sha256 } from "./canonical.js";
import { evaluateAction } from "./evaluate.js";
import type {
  ActionEnvelope,
  ActionPolicy,
  ActionReceipt,
  Approval,
  ReceiptVerification,
} from "./types.js";

type ReceiptPayload = Omit<ActionReceipt, "receiptHash">;

export async function createReceipt(input: {
  action: ActionEnvelope;
  policy: ActionPolicy;
  approvals?: Approval[];
  previousReceipt?: ActionReceipt;
  now?: Date;
}): Promise<ActionReceipt> {
  const now = input.now ?? new Date();
  const evaluation = evaluateAction(input.action, input.policy, now);
  const approvals = input.approvals ?? [];
  const receiptIdSeed = `${input.action.id}:${evaluation.evaluatedAt}:${input.previousReceipt?.receiptHash ?? "root"}`;

  const distinctApprovers = new Set(approvals.map((approval) => approval.approver));
  if (evaluation.decision === "review" && distinctApprovers.size < evaluation.approval.required) {
    throw new Error(
      `Decision requires ${evaluation.approval.required} distinct approval(s); received ${distinctApprovers.size}.`,
    );
  }

  if (
    evaluation.approval.roles.length > 0 &&
    approvals.some((approval) => !evaluation.approval.roles.includes(approval.role))
  ) {
    throw new Error(`Approver role must be one of: ${evaluation.approval.roles.join(", ")}.`);
  }
  if (
    evaluation.approval.expiresInMinutes !== null &&
    approvals.some((approval) => {
      const approvedAt = Date.parse(approval.approvedAt);
      const age = now.getTime() - approvedAt;
      return (
        Number.isNaN(approvedAt) ||
        age < 0 ||
        age > evaluation.approval.expiresInMinutes! * 60_000
      );
    })
  ) {
    throw new Error(
      `Approval must be valid and no older than ${evaluation.approval.expiresInMinutes} minutes.`,
    );
  }

  const payload: ReceiptPayload = {
    receiptVersion: "1.0",
    receiptId: (await sha256(receiptIdSeed)).slice(0, 24),
    evaluatedAt: evaluation.evaluatedAt,
    actionId: input.action.id,
    actionHash: await sha256(input.action),
    policyId: input.policy.id,
    policyHash: await sha256(input.policy),
    decision: evaluation.decision,
    riskScore: evaluation.riskScore,
    matchedRuleIds: evaluation.matchedRules.map((rule) => rule.id),
    approvals,
    previousReceiptHash: input.previousReceipt?.receiptHash ?? null,
  };

  return {
    ...payload,
    receiptHash: await sha256(payload),
  };
}

export async function verifyReceipt(input: {
  receipt: ActionReceipt;
  action?: ActionEnvelope;
  policy?: ActionPolicy;
  previousReceipt?: ActionReceipt;
}): Promise<ReceiptVerification> {
  const { receipt } = input;
  const { receiptHash, ...payload } = receipt;
  const evaluation =
    input.action && input.policy
      ? evaluateAction(input.action, input.policy, new Date(receipt.evaluatedAt))
      : undefined;
  const distinctApprovers = new Set(receipt.approvals.map((approval) => approval.approver));
  const approvalValid = evaluation
    ? evaluation.decision !== "review" ||
      (distinctApprovers.size >= evaluation.approval.required &&
        receipt.approvals.every(
          (approval) =>
            evaluation.approval.roles.length === 0 ||
            evaluation.approval.roles.includes(approval.role),
        ))
    : receipt.decision !== "review" || distinctApprovers.size > 0;
  const checks: ReceiptVerification["checks"] = {
    receiptHash: (await sha256(payload)) === receiptHash,
    actionHash: input.action ? (await sha256(input.action)) === receipt.actionHash : null,
    policyHash: input.policy ? (await sha256(input.policy)) === receipt.policyHash : null,
    previousReceiptHash: input.previousReceipt
      ? input.previousReceipt.receiptHash === receipt.previousReceiptHash
      : receipt.previousReceiptHash === null
        ? true
        : null,
    evaluation: evaluation
      ? evaluation.decision === receipt.decision &&
        evaluation.riskScore === receipt.riskScore &&
        evaluation.matchedRules.map((rule) => rule.id).join(",") === receipt.matchedRuleIds.join(",")
      : null,
    approvals: approvalValid,
  };
  const errors = Object.entries(checks)
    .filter(([, valid]) => valid === false)
    .map(([name]) => `${name} check failed`);

  return {
    valid: errors.length === 0,
    checks,
    errors,
  };
}

export function serializeReceipt(receipt: ActionReceipt): string {
  return `${canonicalJson(receipt)}\n`;
}
