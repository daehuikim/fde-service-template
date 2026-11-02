# Contributing

[English](CONTRIBUTING.md) · [한국어](README.ko.md)

Use a `codex/` or focused feature branch. Describe the problem and observable behavior before introducing a new abstraction or dependency. The Python package lives under `src/fde_workbench`; the optional web example remains under `apps/web` and `packages`.

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

For JS/web changes, also run `pnpm qa` and `pnpm eval:fixture`; DB changes require the real database tests. Product figures are generated with `pnpm assets`, visually reviewed as PNGs, and checked with `pnpm assets:check`. Architecture/source changes require `pnpm diagram` before `pnpm qa`.

Use real, small Conventional Commits. Preserve upstream licenses and source provenance. Keep secrets/customer data out of public commits. Before publishing, run the tracked-file and gitleaks history scan. Do not turn a source-reference check or synthetic test into a claim of business effectiveness.
