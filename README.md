# BatasAksi

**A local-first preflight control plane for AI agent actions.**

AI agents can draft, delete, send, purchase, and publish. BatasAksi gives those
actions a vendor-neutral contract *before* a side effect happens: an Action
Envelope goes through deterministic policy, receives `allow`, `review`, or
`deny`, and produces a tamper-evident receipt.

> **Bahasa Indonesia:** BatasAksi membantu tim memberi batas tindakan kepada AI
> agent sebelum agent menulis data, mengirim pesan, menghapus sesuatu, atau
> melakukan transaksi. Semua simulasi berjalan lokal.

## Why this exists

Most agent security projects sit on the network path, scan content, or protect
one agent framework. BatasAksi focuses on an earlier question:

> Can the team explain and approve this exact proposed action before execution?

It is deliberately a **preflight simulator and portable contract**, not another
proxy. Teams can model rules, test risky scenarios, review policy weakening, and
generate verifiable evidence before integrating a runtime gateway.

| Capability | BatasAksi | Network firewall | Prompt confirmation |
| --- | --- | --- | --- |
| Works before side effects | Yes | At execution | Sometimes |
| Vendor-neutral action schema | Yes | Usually transport-specific | No |
| Policy regression diff | Yes | Varies | No |
| Role/count approval requirements | Yes | Varies | Usually one click |
| Content-bound receipt chain | Yes | Varies | No |
| Executes or proxies actions | No | Yes | Framework-specific |

No originality claim can be proved for every repository on the internet.
BatasAksi's distinct scope is the combination of portable preflight contracts,
policy simulation, weakening detection, and local tamper-evident receipts.

## What is included

- `@batasaksi/core`: dependency-light TypeScript policy and receipt engine;
- `batasaksi` CLI: simulate, issue receipts, verify evidence, and diff policies;
- BatasAksi Studio: local browser UI with editable JSON and decision traces;
- four realistic scenarios and two policy versions;
- protocol, policy, integration, and threat-model documentation;
- tests for conflict resolution, fail-closed expiry, receipt mutation, approval
  enforcement, policy weakening, and CLI output.

## Quick start

Requirements: Node.js 20 or newer.

```bash
git clone https://github.com/vtino17/batas-aksi.git
cd batas-aksi
corepack enable
pnpm install
pnpm check
pnpm dev
```

Open the local URL printed by Vite. The Studio does not send action or policy
content to a server.

## CLI

Simulate a harmless read:

```bash
pnpm batasaksi simulate \
  examples/actions/read-local.json \
  examples/policies/team-safety.json
```

Check an irreversible production deletion:

```bash
pnpm batasaksi simulate \
  examples/actions/delete-production-data.json \
  examples/policies/team-safety.json \
  --fail-on deny
```

Issue and verify an approval-bound receipt:

```bash
mkdir -p receipts

pnpm batasaksi receipt \
  examples/actions/send-customer-email.json \
  examples/policies/team-safety.json \
  --approved-by "Ayu:communications-owner" \
  --output receipts/email.json

pnpm batasaksi verify receipts/email.json \
  --action examples/actions/send-customer-email.json \
  --policy examples/policies/team-safety.json
```

Detect a policy regression:

```bash
pnpm batasaksi diff-policy \
  examples/policies/team-safety.json \
  examples/policies/team-safety-weakened.json
```

The diff command intentionally exits non-zero when controls are weakened, which
makes it suitable for pull-request checks.

## Decision model

Rules match structured facts such as tool, operation, environment, target,
effects, data class, reversibility, and estimated amount. All matching rules are
kept in the trace; the strongest result wins:

```text
deny > review > allow
```

The risk score explains characteristics of an action. It never overrides policy.
Invalid or expired envelopes fail closed.

## Receipt model

A receipt contains SHA-256 hashes of the canonical Action Envelope and policy,
plus the decision, risk, matching rule IDs, approvals, and the optional hash of
the previous receipt.

```text
action ─┐
policy ─┼─> evaluate ─> decision ─> canonical receipt ─> SHA-256
approval┘                                      │
previous receipt hash ─────────────────────────┘
```

Receipts detect mutation; they are not digital signatures. See the
[threat model](docs/THREAT-MODEL.md) for trust assumptions and production
hardening.

## Documentation

- [Action Envelope specification](docs/ACTION-ENVELOPE.md)
- [Policy specification](docs/POLICY.md)
- [Integration guide](docs/INTEGRATION.md)
- [Threat model](docs/THREAT-MODEL.md)

## Design references

The project responds to the risk of excessive agent autonomy described by
[OWASP LLM06:2025 Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/).
Its emphasis on explicit roles and tracked risk information aligns with the
[NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework).
The human review experience also follows the
[Model Context Protocol guidance](https://modelcontextprotocol.io/specification/2025-11-25/client/sampling)
that users should be able to inspect and deny requests.

These references inform the design; they do not certify or endorse BatasAksi.

## Repository layout

```text
apps/studio/       Local React interface
packages/core/     Policy, validation, diff, and receipt engine
packages/cli/      Automation-friendly CLI
examples/          Actions and policies ready to run
docs/              Specifications and security guidance
```

## Status

BatasAksi is an experimental reference implementation. Do not use it as the
only control protecting money, production deletion, credentials, or regulated
data. Contributions and adversarial test cases are welcome.

## License

[MIT](LICENSE)
