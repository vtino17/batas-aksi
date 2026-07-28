import type {
  EvaluationResult,
  PolicyDiff,
  ReceiptVerification,
} from "@batasaksi/core";

const icons = {
  allow: "✓ ALLOW",
  review: "◇ REVIEW",
  deny: "✕ DENY",
};

export function formatEvaluation(result: EvaluationResult): string {
  const rules =
    result.matchedRules.length === 0
      ? "none"
      : result.matchedRules.map((rule) => `${rule.id} (${rule.effect})`).join(", ");
  const approval =
    result.approval.required === 0
      ? "not required"
      : `${result.approval.required} from ${result.approval.roles.join(" / ") || "any role"}`;

  return [
    `${icons[result.decision]}  ${result.actionId}`,
    `Risk       ${result.riskScore}/100 · ${result.riskSignals.join(", ") || "no elevated signals"}`,
    `Rules      ${rules}`,
    `Approval   ${approval}`,
    ...result.reasons.map((reason) => `Reason     ${reason}`),
  ].join("\n");
}

export function formatVerification(result: ReceiptVerification): string {
  const lines = Object.entries(result.checks).map(([name, value]) => {
    const status = value === null ? "SKIP" : value ? "PASS" : "FAIL";
    return `${status.padEnd(4)}  ${name}`;
  });
  return [`${result.valid ? "✓ VALID" : "✕ INVALID"} receipt`, ...lines].join("\n");
}

export function formatDiff(result: PolicyDiff): string {
  return [
    `Policy diff  ${result.from} → ${result.to}`,
    `Added        ${result.added.join(", ") || "none"}`,
    `Removed      ${result.removed.join(", ") || "none"}`,
    `Modified     ${result.modified.join(", ") || "none"}`,
    `Weakened     ${result.weakenedControls.length}`,
    ...result.weakenedControls.map((entry) => `! ${entry}`),
  ].join("\n");
}
