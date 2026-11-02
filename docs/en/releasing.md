# Release and distribution

[English](releasing.md) · [한국어](../ko/releasing.md)

The project is MIT licensed and distributed as a pure-Python wheel, source archive and portable skill ZIP. Version 0.2.0 is a beta release. Shipping a validated package does not establish the effectiveness of a design in a customer environment.

## Build a release candidate

Use a clean checkout with a matching version/tag. `uv.lock` pins development dependencies; the build backend is pinned in pyproject.toml. Runtime compatibility is declared separately.

```sh
uv sync --frozen
uv run ruff check src tests
uv run ruff format --check src tests
uv run pytest
uv build
uv run twine check dist/*
uv run python scripts/package-smoke.py
uv run python scripts/release-artifacts.py
```

Start with a clean `dist/` for each build. The smoke test creates an isolated virtual environment outside the checkout, installs the wheel, exercises both languages and checks bundled reports, archives and skill resources. Release artifacts include the wheel, sdist, skill ZIP and SHA256SUMS. No application/customer data is included.

The GitHub package workflow repeats checks on Linux/Python3.10–3.13, macOS/Python3.12 and Windows/Python3.12. Inspect all job outcomes before publishing. A failed or skipped environment must not be reported as tested.

## GitHub release

After CI passes, tag the reviewed commit as `v0.2.0` and attach `dist/` assets to the corresponding release. Install from the pinned Git tag, or download a wheel and verify its digest against SHA256SUMS before installing. The package has no service or database migrations to deploy.

## PyPI trusted publishing

The workflow `publish-pypi.yml` is manual and uses a `pypi` GitHub environment plus OIDC. It does not contain an API token. Before its first run, the owner must:

1. Register/claim the distribution and configure the GitHub repository/workflow as a trusted publisher on PyPI.
2. Create the `pypi` environment with appropriate maintainer/release restrictions.
3. Dispatch the workflow with the already-reviewed release tag. The workflow verifies the tag against the package version, runs tests and isolated installation, builds, then publishes.

This configuration is not a claim that the package is already on PyPI. No PyPI upload is performed by ordinary CI, local builds or `fde` commands. [Official trusted-publishing guide](https://docs.pypi.org/trusted-publishers/)

## Compatibility and rollback

The design contract remains `fde.design.v1`; the Python port tightens calendar/URL validation and provides JSON-key/size guards at the CLI boundary. Back up design records before upgrading. Reinstall the prior pinned package version to roll back the CLI; do not overwrite workspaces or installed skills silently. The installer deliberately rejects an existing skill directory so it can be reviewed before replacement.

## Current boundaries

The core provides deterministic artifact validation and delivery, not autonomous research, source entailment verification, provider execution or hosted SaaS. Skills use the host assistant's available reasoning and permissions. Model quality, user benefit, report readability with real users and a deployed service's operational controls need task-specific evaluation.
