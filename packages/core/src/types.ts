export const decisions = ["allow", "review", "deny"] as const;
export type Decision = (typeof decisions)[number];

export const effects = [
  "read",
  "write",
  "external",
  "financial",
  "destructive",
  "credential",
] as const;
export type Effect = (typeof effects)[number];

export interface AgentIdentity {
  id: string;
  name: string;
  sessionId: string;
}

export interface ToolIdentity {
  namespace: string;
  name: string;
  operation: string;
}

export interface ActionTarget {
  kind: string;
  locator: string;
  environment: "local" | "development" | "staging" | "production";
}

export interface EstimatedCost {
  amount: number;
  currency: string;
}

export interface ActionEnvelope {
  schemaVersion: "1.0";
  id: string;
  agent: AgentIdentity;
  intent: string;
  tool: ToolIdentity;
  target: ActionTarget;
  effects: Effect[];
  dataClasses: string[];
  reversible: boolean;
  requestedAt: string;
  expiresAt?: string;
  estimatedCost?: EstimatedCost;
  metadata?: Record<string, unknown>;
}

export interface RuleCondition {
  tools?: string[];
  operations?: string[];
  targetPatterns?: string[];
  environments?: ActionTarget["environment"][];
  effectsAny?: Effect[];
  effectsAll?: Effect[];
  dataClassesAny?: string[];
  reversible?: boolean;
  minAmount?: number;
  maxAmount?: number;
}

export interface ApprovalRequirement {
  count: number;
  roles?: string[];
  expiresInMinutes?: number;
}

export interface PolicyRule {
  id: string;
  description: string;
  priority: number;
  effect: Decision;
  when: RuleCondition;
  require?: ApprovalRequirement;
}

export interface ActionPolicy {
  policyVersion: "1.0";
  id: string;
  name: string;
  defaultDecision: Decision;
  rules: PolicyRule[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface MatchedRule {
  id: string;
  description: string;
  priority: number;
  effect: Decision;
}

export interface EvaluationResult {
  actionId: string;
  policyId: string;
  decision: Decision;
  riskScore: number;
  riskSignals: string[];
  matchedRules: MatchedRule[];
  approval: {
    required: number;
    roles: string[];
    expiresInMinutes: number | null;
  };
  reasons: string[];
  evaluatedAt: string;
}

export interface Approval {
  approver: string;
  role: string;
  approvedAt: string;
  note?: string;
}

export interface ActionReceipt {
  receiptVersion: "1.0";
  receiptId: string;
  evaluatedAt: string;
  actionId: string;
  actionHash: string;
  policyId: string;
  policyHash: string;
  decision: Decision;
  riskScore: number;
  matchedRuleIds: string[];
  approvals: Approval[];
  previousReceiptHash: string | null;
  receiptHash: string;
}

export interface ReceiptVerification {
  valid: boolean;
  checks: {
    receiptHash: boolean;
    actionHash: boolean | null;
    policyHash: boolean | null;
    previousReceiptHash: boolean | null;
    evaluation: boolean | null;
    approvals: boolean;
  };
  errors: string[];
}

export interface PolicyDiff {
  from: string;
  to: string;
  defaultDecisionChanged: boolean;
  added: string[];
  removed: string[];
  modified: string[];
  weakenedControls: string[];
}
