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
