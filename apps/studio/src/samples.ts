import type { ActionEnvelope, ActionPolicy } from "@batasaksi/core";

export const samplePolicy: ActionPolicy = {
  policyVersion: "1.0",
  id: "team-safety-v1",
  name: "Team safety baseline",
  defaultDecision: "review",
  rules: [
    {
      id: "deny-secret-egress",
      description: "Credentials and secrets may never leave the trusted boundary.",
      priority: 200,
      effect: "deny",
      when: {
        effectsAny: ["external"],
        dataClassesAny: ["credential", "secret"],
      },
    },
    {
      id: "deny-production-destruction",
      description: "Irreversible destructive actions in production are prohibited.",
      priority: 190,
      effect: "deny",
      when: {
        environments: ["production"],
        effectsAny: ["destructive"],
        reversible: false,
      },
    },
    {
      id: "review-financial",
      description: "Every financial action needs a finance owner.",
      priority: 120,
      effect: "review",
      when: {
        effectsAny: ["financial"],
        minAmount: 1,
      },
      require: {
        count: 2,
        roles: ["finance-owner"],
        expiresInMinutes: 10,
      },
    },
    {
      id: "review-external-write",
      description: "External writes need a responsible owner.",
      priority: 100,
      effect: "review",
      when: {
        effectsAll: ["external", "write"],
      },
      require: {
        count: 1,
        roles: ["communications-owner", "service-owner"],
        expiresInMinutes: 15,
      },
    },
    {
      id: "allow-read-only",
      description: "Read-only actions without credentials can proceed.",
      priority: 10,
      effect: "allow",
      when: {
        effectsAll: ["read"],
        reversible: true,
      },
    },
  ],
};

export const samples: Record<string, ActionEnvelope> = {
  "Ringkas dokumen": {
    schemaVersion: "1.0",
    id: "act-read-001",
    agent: { id: "research-agent", name: "Research assistant", sessionId: "demo-01" },
    intent: "Read and summarize the local project brief",
    tool: { namespace: "filesystem", name: "documents", operation: "read_file" },
    target: { kind: "file", locator: "brief/project.md", environment: "local" },
    effects: ["read"],
    dataClasses: ["internal"],
    reversible: true,
    requestedAt: "2026-07-28T02:00:00.000Z",
  },
  "Kirim email pelanggan": {
    schemaVersion: "1.0",
    id: "act-email-002",
    agent: { id: "support-agent", name: "Support copilot", sessionId: "demo-02" },
    intent: "Send an incident update to affected customers",
    tool: { namespace: "google", name: "gmail", operation: "send_email" },
    target: { kind: "email", locator: "customers@external.example", environment: "production" },
    effects: ["write", "external"],
    dataClasses: ["personal"],
    reversible: false,
    requestedAt: "2026-07-28T02:05:00.000Z",
  },
  "Hapus data produksi": {
    schemaVersion: "1.0",
    id: "act-delete-003",
    agent: { id: "ops-agent", name: "Database caretaker", sessionId: "demo-03" },
    intent: "Delete customer records considered stale",
    tool: { namespace: "database", name: "postgres", operation: "delete_rows" },
    target: { kind: "database", locator: "prod/customers", environment: "production" },
    effects: ["write", "destructive"],
    dataClasses: ["personal"],
    reversible: false,
    requestedAt: "2026-07-28T02:10:00.000Z",
  },
  "Bayar vendor": {
    schemaVersion: "1.0",
    id: "act-pay-004",
    agent: { id: "finance-agent", name: "Invoice assistant", sessionId: "demo-04" },
    intent: "Pay an approved cloud infrastructure invoice",
    tool: { namespace: "banking", name: "transfer", operation: "create_payment" },
    target: { kind: "bank-account", locator: "vendor/cloud-provider", environment: "production" },
    effects: ["write", "external", "financial"],
    dataClasses: ["financial"],
    reversible: false,
    estimatedCost: { amount: 12_500_000, currency: "IDR" },
    requestedAt: "2026-07-28T02:15:00.000Z",
  },
};
