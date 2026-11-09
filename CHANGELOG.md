# Changelog

## Unreleased

- Add Elephant-Goldfish verification as round 3 of the multi-agent discussion (pattern from google/elephant-goldfish-model): the synthesized report is rendered as Markdown and reviewed by fresh-context reviewers that see only the report and the problem packet. Built-in reviewers: deterministic structural audit, comprehension and zoom-out. Failing reviewers are retried once and reported as `not_run`, never as "no findings"; host-run goldfish findings can be imported with the transcript. Adds a verdict (`pass`, `attention`, `blocked`, `incomplete`), a verification tab with human accept/defer decisions, Markdown report export, `pnpm discussion report` and ADR 0004.
- Add a multi-agent discussion structure: lens agents bound to the project skills explore one problem in parallel (blind round 1), cross-review each other's claims (round 2), and a deterministic synthesis ranks consensus, contested claims and next checks. Includes the `discussion.v1` contract, `packages/agents` orchestrator with per-agent timeouts and failure records, an offline semiconductor fixture provider, `POST /api/discussions` (NDJSON stream or transcript import, `run:create`), the `/discussion` workspace, `pnpm discussion`, the `fde-multi-agent-review` skill and ADR 0003.
- Add the `fde-enterprise-stack` skill: one workflow that takes a user task from UI state to API, RBAC, DB constraints, deployment settings and real-database verification, with references on auth/authorization tool selection, data-model and migration rules, network/frontend rules and a release checklist.
- Add session authentication (`packages/auth`): scrypt password hashing with OWASP parameters, hashed opaque session tokens, HttpOnly cookies, same-origin CSRF checks and per-account login lockout; fixture mode ships demo accounts.
- Add tenant RBAC and per-user working memory on PostgreSQL: 31 new tables across four forward-only migrations (identity, tenancy/RBAC, workspace, operations), row-level security on every tenant table, composite tenant foreign keys, append-only audit log, transactional outbox, jobs, idempotency keys and optimistic `version` locking; the migration runner now keeps a checksum ledger.
- Add `/api/auth/*`, `/api/work-items` and `/api/memory` routes, a sidebar sign-in panel, `APP_ORIGIN`/`SERVICE_PERMISSIONS` settings, stricter Caddy headers, ADR 0002 and extended fixture and live-database tests.

- Add open-source collaboration rules: governance and maintainer roles, Code of Conduct, bilingual contributing guide, CODEOWNERS, issue forms and an updated PR template.
- Add a `main` branch ruleset (`.github/rulesets/main.json`) and a repository-settings record for maintainers.
- Add a showcase: one JSON file per case in `showcase/entries`, rendered into `SHOWCASE.md` and the README by `scripts/showcase.mjs`, validated in CI by the `showcase` job.
- Add review lenses to the portable skill: feature teardown, compatibility and deployment scalability, validation method, target-environment fit, field debugging, security/data boundary and cost model.
- Add matching project skills (`fde-feature-teardown`, `fde-compat-scale-review`, `fde-validation-review`, `fde-target-env`, `fde-field-debug`, `fde-security-review`, `fde-cost-model`) and a skill catalog.
- Add a read-only POSIX environment probe and an OS/runtime compatibility matrix for customer deployments.
- Test that the repository copy of the portable skill matches the packaged resources.

## 0.2.0 — 2026-11-02

- Introduce the installable `fde-workbench` Python CLI and typed library.
- Add self-contained resources, English/Korean examples, offline HTML reports and handoff ZIPs.
- Package the portable agent skill with a contract, reference, license and file manifest.
- Add Python build/install tests, release artifacts and gated PyPI publishing configuration.
- Rework the README into English/Korean entrypoints with original product figures.
- Keep the web-service example separate; consolidate case references in this repository.

## 0.1.0 — 2026-11-02

- Initial web-service example, deterministic CSV validation, PostgreSQL boundaries, design records and review tooling.
