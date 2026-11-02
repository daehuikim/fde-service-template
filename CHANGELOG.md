# Changelog

## Unreleased

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
