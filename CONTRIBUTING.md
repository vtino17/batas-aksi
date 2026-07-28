# Contributing

Thanks for helping improve BatasAksi.

1. Open an issue describing the action type, policy behavior, or security
   property you want to change.
2. Keep the evaluation path deterministic and independent of model output.
3. Add tests for allow, review, deny, malformed input, and overlapping rules
   where relevant.
4. Run `pnpm check`.
5. Explain any trust-boundary change in the pull request.

Security vulnerabilities should follow [SECURITY.md](SECURITY.md), not a public
issue.
