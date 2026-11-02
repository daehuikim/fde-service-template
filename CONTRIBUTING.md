# Contributing

[English](CONTRIBUTING.md) · [한국어](CONTRIBUTING.ko.md)

Thanks for helping. This file covers how work flows from an idea to a merged change. Who decides what is in [GOVERNANCE.md](GOVERNANCE.md); everyone follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

| You want to | Do this |
|---|---|
| Report a bug | [Bug report](https://github.com/daehuikim/fde-service-template/issues/new?template=bug_report.yml) with the command, version and output |
| Suggest a feature or a new skill | [Feature or skill proposal](https://github.com/daehuikim/fde-service-template/issues/new?template=feature_request.yml) first; agree on the problem before code |
| Share a good use of the toolkit | Add a [showcase entry](showcase/README.md) by PR, or open a [showcase issue](https://github.com/daehuikim/fde-service-template/issues/new?template=showcase.yml) |
| Fix docs or a small bug | Open a PR directly |
| Report a vulnerability | **Do not open an issue.** Follow [SECURITY.md](SECURITY.md) |

Issues labeled `good first issue` are scoped for newcomers. Comment on an issue before starting larger work so effort is not duplicated.

## Workflow

1. Fork the repository (maintainers may use a branch in this repository). Name branches after the change: `feat/…`, `fix/…`, `docs/…`, `skill/…`, `showcase/…`.
2. Keep one change per PR. Describe the problem and observable behavior before introducing a new abstraction or dependency.
3. Use real, small [Conventional Commits](https://www.conventionalcommits.org/): `feat(skill): …`, `fix(cli): …`, `docs: …`.
4. Run the checks for what you touched (below) and open a PR against `main` using the template.
5. CI must be green and a [code owner](.github/CODEOWNERS) must approve. Resolve every review thread. Maintainers merge; nobody pushes to `main` directly.

`main` is protected: no direct pushes, force-pushes or deletion, and merges require review and passing checks. See [repository settings](docs/maintainers/repository-settings.md).

## Checks

Python package (`src/fde_workbench`):

```sh
uv sync --frozen
uv run ruff check src tests
uv run ruff format --check src tests
uv run pytest
uv build
uv run twine check dist/*
uv run python scripts/package-smoke.py
```

Keep the schema copies in `packages/contracts`, the Python resources and the skill reference in sync; the parity test checks them. New package resources must work from an installed wheel outside this checkout. Change both localized example variants and both README entrypoints when behavior changes. User-authored content is not automatically translated.

Skills (`.agents/skills`): add a row to the [skill catalog](.agents/skills/README.md). When changing the portable `fde-workbench` skill, update both the packaged copy under `src/fde_workbench/resources/skill` and the repository copy, and regenerate its manifest.

JS/web example: run `pnpm qa` and `pnpm eval:fixture`; DB changes require the real database tests. Product figures are generated with `pnpm assets`, visually reviewed as PNGs, and checked with `pnpm assets:check`. Source, script or workflow changes require `pnpm diagram` before `pnpm qa`.

Showcase and docs only: `node scripts/showcase.mjs --check` and `node scripts/docs-check.mjs`. Neither needs an install.

## Ground rules

- Preserve upstream licenses and source provenance.
- Keep secrets, customer data, internal hostnames and non-public logs out of commits, issues and showcase links. Before publishing, run the tracked-file and gitleaks history scan.
- Do not turn a source-reference check or synthetic test into a claim of business effectiveness.
- Do not force-push shared branches or rewrite history someone else depends on.
- AI-assisted contributions are welcome. You are responsible for every line you submit and must be able to explain it.

By contributing you agree that your work is licensed under the [MIT License](LICENSE).
