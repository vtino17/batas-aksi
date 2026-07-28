# Action Envelope 1.0

An Action Envelope is a vendor-neutral description of a proposed side effect. It
must be produced before a tool is invoked. BatasAksi evaluates the envelope; it
never executes the action itself.

## Required fields

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Currently `"1.0"` |
| `id` | Unique action attempt identifier |
| `agent` | Stable agent, display name, and session identifiers |
| `intent` | Human-readable reason for the action |
| `tool` | Tool namespace, name, and operation |
| `target` | Resource kind, locator, and environment |
| `effects` | One or more declared effect classes |
| `dataClasses` | Data categories touched by the action |
| `reversible` | Whether the integrator can reliably undo the action |
| `requestedAt` | ISO-8601 timestamp |

Optional fields are `expiresAt`, `estimatedCost`, and application-specific
`metadata`.

## Effect vocabulary

- `read`: obtains information without intended mutation.
- `write`: changes state.
- `external`: crosses a trust boundary or communicates outside the system.
- `financial`: moves or commits money.
- `destructive`: deletes or irreversibly replaces state.
- `credential`: accesses, creates, rotates, or reveals authentication material.

Effects are intentionally additive. Sending an email is both `write` and
`external`; a wire transfer is `write`, `external`, and `financial`.

## Trust boundary

The party constructing an envelope can lie. A secure integration should build
envelopes in trusted adapter code, derive fields from structured tool arguments,
and reject operations that cannot be represented accurately. Do not ask an LLM
to self-classify its effects and treat that classification as authoritative.
