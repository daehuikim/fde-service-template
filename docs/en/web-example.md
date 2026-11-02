# Optional web-service example

The Next.js/CSV/PostgreSQL example is retained for implementation experiments. It is independent of the installable Python core and is excluded from wheel/sdist.

```sh
pnpm install --frozen-lockfile
pnpm setup:tools --profile restricted-assignment
pnpm dev
pnpm qa
pnpm eval:fixture
```

The fixture UI runs locally without API keys. Production fixture requests are blocked; the live API requires server-side credentials and PostgreSQL. Human-facing production authentication, observability and backup automation are service-specific work. [Deployment runbook](../../deploy/README.md) · [Operating limits](../operations.md)
