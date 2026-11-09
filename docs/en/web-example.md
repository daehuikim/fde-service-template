# Optional web-service example

The Next.js/CSV/PostgreSQL example is retained for implementation experiments. It is independent of the installable Python core and is excluded from wheel/sdist.

```sh
pnpm install --frozen-lockfile
pnpm setup:tools --profile restricted-assignment
pnpm dev
pnpm qa
pnpm eval:fixture
```

The fixture UI runs locally without API keys and includes demo accounts (`owner@example.com` / `demo-owner-password`, `viewer@example.com` / `demo-viewer-password`) for the session, RBAC and per-user memory routes. Production fixture requests are blocked; the live API requires server-side credentials and PostgreSQL with the migrations in `packages/db/migrations` applied. Session login, tenant RBAC and row-level security are implemented and tested against a real database (`pnpm test:db`); SSO, observability and backup automation remain service-specific work. See [ADR 0002](../adr/0002-identity-and-authorization.md) and the `fde-enterprise-stack` skill. [Deployment runbook](../../deploy/README.md) · [Operating limits](../operations.md)

## Multi-agent discussion

`/discussion` runs one field problem through several lens agents in parallel. Round 1 is blind exploration; round 2 is cross-review (support, challenge, refine). A deterministic synthesis in `packages/domain/discussion.ts` sorts claims into consensus, contested and single-source and ranks the next checks. The template ships only an offline, rule-based fixture provider with three synthetic semiconductor problems; real model runs happen in your host assistant through the [`fde-multi-agent-review` skill](../../.agents/skills/fde-multi-agent-review/SKILL.md) and are imported as a transcript (`pnpm discussion synthesize transcript.json`). A third round applies the Elephant-Goldfish pattern: the rendered report goes to reviewers with no access to the discussion, and the result carries a verdict. See [ADR 0003](../adr/0003-multi-agent-discussion.md) and [ADR 0004](../adr/0004-goldfish-verification.md).
