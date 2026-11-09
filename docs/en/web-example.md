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

`/discussion` shows a multi-agent discussion record produced by your host assistant (Claude Code, Codex) with the [`fde-multi-agent-review` skill](../../.agents/skills/fde-multi-agent-review/SKILL.md). Lens subagents explore one field problem in parallel (round 1, blind) and cross-review each other's claims (round 2); a synthesizer subagent classifies claims and ranks the next checks; fresh-context goldfish subagents review the rendered report and the record carries their verdict (round 3, Elephant-Goldfish pattern). The app makes no judgments and runs no agents: `POST /api/discussions {record}` and `pnpm discussion check` only verify the contract, references and that the goldfish reviewed exactly this report. A synthetic example record ships in `packages/agents/examples/`. See [ADR 0003](../adr/0003-multi-agent-discussion.md), [ADR 0004](../adr/0004-goldfish-verification.md) and [ADR 0005](../adr/0005-skill-only-judgment.md).
