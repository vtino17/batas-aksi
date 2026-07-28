# Policy 1.0

A policy contains a default decision and deterministic rules. Every matching
rule is retained in the decision trace. The strongest effect wins:

```text
deny > review > allow
```

This deny-overrides behavior prevents a broad allow rule from masking a narrow
protective rule.

## Conditions

| Condition | Behavior |
| --- | --- |
| `tools` | Glob-match `namespace/name` |
| `operations` | Glob-match operation name |
| `targetPatterns` | Glob-match target locator |
| `environments` | Match local, development, staging, or production |
| `effectsAny` | At least one declared effect must match |
| `effectsAll` | Every listed effect must match |
| `dataClassesAny` | At least one data class must match |
| `reversible` | Match exact reversibility |
| `minAmount` | Match cost at or above the value |
| `maxAmount` | Match cost at or below the value |

Conditions within one rule use AND semantics. Values within an `Any` condition
use OR semantics.

## Reviews

A review rule can require a number of approvals, acceptable roles, and an expiry
window. The receipt generator refuses to create an approved review receipt
without the required count or with an unaccepted role.

## Policy changes

Run `batasaksi diff-policy old.json new.json` in review or CI. It exits with code
4 when it finds a weaker default, a removed protective rule, a weaker rule
effect, or fewer required approvals.
