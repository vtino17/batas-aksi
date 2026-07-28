# Threat model

## Protected assets

- user intent and authorization boundaries;
- production data and external communications;
- policy integrity;
- evidence linking an action to the policy decision made for it.

## In scope

- an agent proposes an action it should not perform;
- prompt injection influences a proposed tool call;
- a broad allow rule overlaps a narrow deny rule;
- a policy change silently weakens controls;
- an action, policy, approval, or receipt is modified after evaluation;
- a high-impact action lacks the required human role.

## Security properties

- deterministic evaluation without an LLM in the decision path;
- schema validation before matching;
- deny-overrides conflict resolution;
- expired envelopes fail closed;
- content hashes bind receipts to the exact action and policy;
- optional previous hashes create a tamper-evident receipt chain;
- weakening detection makes policy review explicit.

## Out of scope

BatasAksi is not a sandbox, identity provider, network proxy, signature service,
or tool executor. Hashes detect mutation but do not prove who created a receipt.
For non-repudiation, sign receipt hashes with an external KMS or transparency
service.

The project cannot prevent time-of-check/time-of-use substitution by itself.
Integrators must pass the evaluated, hashed arguments to the executor without
reconstruction and should verify the receipt immediately before execution.

Risk scores are explanatory heuristics, not authorization decisions. Policy
rules—not the score—determine allow, review, or deny.
