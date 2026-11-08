<p align="center">
  <a href="README.md"><strong>English</strong></a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <img src="docs/assets/hero.png" alt="FDE Workbench — evidence-led problem design, Python CLI, SDK and portable agent skill" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/daehuikim/fde-service-template/actions/workflows/python.yml"><img src="https://github.com/daehuikim/fde-service-template/actions/workflows/python.yml/badge.svg" alt="Python package CI" /></a>
  <a href="https://github.com/daehuikim/fde-service-template/releases"><img src="https://img.shields.io/github/v/release/daehuikim/fde-service-template?color=178676" alt="GitHub release" /></a>
  <img src="https://img.shields.io/badge/python-3.10%2B-3776AB" alt="Python 3.10 and later" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-178676" alt="MIT license" /></a>
</p>

**Turn an operational problem into a concise brief, a defensible approach, and a design worth building.**

FDE Workbench pairs a portable agent skill with an offline Python CLI and library. Your assistant investigates and reasons; the package checks evidence links, renders briefs, and ships reviewable artifacts. Choose methods for the problem—rules, SQL, retrieval, optimization, LLMs or an ontology—when the evidence warrants them.

[Get started](#get-started) · [Guide](docs/en/guide.md) · [CLI & Python API](docs/en/api.md) · [Architecture](#how-it-fits) · [Releases](https://github.com/daehuikim/fde-service-template/releases)

## Get started

Install the versioned package with [uv](https://docs.astral.sh/uv/):

```sh
uv tool install "fde-workbench==0.2.0"
```

Or install with pip in your environment:

```sh
pip install "fde-workbench==0.2.0"
```

Try the complete synthetic example:

```sh
fde example support-triage --output demo --lang en
fde check demo
fde brief demo --lang en
fde export demo --output review --lang en
```

Open `review/REPORT.html`. Everything needed to read it is included. No Node, API key or model endpoint is needed for these commands. [Wheel, source archive and skill ZIP](https://github.com/daehuikim/fde-service-template/releases/tag/v0.2.0) are also available. Version 0.2.0 is published on [PyPI](https://pypi.org/project/fde-workbench/0.2.0/).

## A short draft first. A deeper design behind it.

Each brief answers seven questions: **background, pain, value hypothesis, technical approach, scale triggers, strongest counterargument, and next check.** Write the brief before completing the full dossier, then connect requirements to evidence, alternatives and failure scenarios.

| Capability | What you get |
|---|---|
| **Problem framing** | The decision, current workflow, owner, assumptions and non-goals |
| **Method comparison** | Mechanisms, data needs, failure conditions and explicit rejection reasons |
| **Critical review** | User, data, cost, security and operating perspectives with residual risks |
| **Artifact checks** | JSON Schema, source/scenario references, claim categories and review gates |
| **Portable delivery** | Markdown, offline HTML, checks and a content-hashed handoff ZIP |
| **Agent integration** | A self-contained skill, installed into a directory you choose |
| **English / Korean** | Documentation, output labels and fully localized synthetic examples |

Checks establish artifact structure and traceability. Source truth, method suitability and customer value still require review. The CLI does not generate a design or call an LLM; the skill guides your existing assistant through that work.

## How it fits

![Host assistant, offline Python core, portable reports and skill delivery](docs/assets/architecture.png)

The core is small: one design record in, checked artifacts out. Models, research tools and data sources remain with your host assistant. The [technology glossary](docs/en/concepts.md) distinguishes ontology, harness, provider, RAG, workflows and agents, including when each adds value and where it fails.

## Use it with your agent

```sh
fde skill install --directory .agents/skills
```

Ask your assistant:

> Use FDE Workbench to review this operational problem. Give me a short draft first, compare relevant approaches, challenge the assumptions, and stop at a design handoff.

The installer adds `fde-workbench/SKILL.md`, its contract, method-selection reference and review lenses. It changes no global configuration and refuses to replace an existing skill. You can also unpack the release skill ZIP into your agent's supported skills directory. [Skill guide](docs/en/guide.md#install-the-skill)

### Review lenses for field work

Beyond problem design, the skill carries focused review lenses you can ask for by name:

| Ask for | You get |
|---|---|
| **Feature teardown** of open-source and commercial options | Module-by-module mechanism, prerequisites, limits, lock-in and evidence grade; adopt / integrate / build / exclude per module |
| **Compatibility and deployment-scalability review** | Version and platform surface, scaling limits with the signals that reveal them, keep / keep-with-conditions / change |
| **Validation-method review** | Whether each test actually proves its claim, the level it reaches, and the claim rewritten to what is proven |
| **Target-environment fit** | Deployment form and image rules matched to the customer's OS, kernel, runtime, Kubernetes and network constraints |
| **Field debugging, security/data boundary, cost model** | Environment diff and hypothesis elimination; data flow and outbound-call inventory; unit cost, sensitivity and break-even |

This repository also includes matching project skills, a read-only customer environment probe, and `fde-enterprise-stack`: a workflow for taking a service from a single app server to session login, tenant RBAC, row-level-secured PostgreSQL schemas and verified deployment settings. See the [skill catalog](.agents/skills/README.md).

## Use it as a Python library

```python
from pathlib import Path
from fde_workbench import check_design, export_report
import json

pack = json.loads(Path("demo/design.json").read_text())
result = check_design(pack)
if result.status == "pass":
    export_report(pack, Path("review"), lang="en")
```

Use `fde bundle demo --output handoff.zip` to hand the same design to another team. The bundle includes the design, brief, report, check results and SHA-256 manifest. [API reference and exit codes](docs/en/api.md)

## Showcase

Good uses of FDE Workbench, ranked on the [showcase leaderboard](SHOWCASE.md). Add yours with a one-file pull request.

<!-- showcase:start -->
| Case | Domain | Evidence | Authors |
|---|---|---|---|
| [EV charging site screening](https://github.com/daehuikim/fde-service-template/tree/main/designs/ev-siting) — Shows why data reconciliation and a survey shortlist come before an investment optimizer, using a public AFDC station snapshot and a numeric counterexample. | energy | Desk review | [@daehuikim](https://github.com/daehuikim) |
| [Partner policy Q&A support](https://github.com/daehuikim/fde-service-template/tree/main/designs/partner-qa) — Starts from approved FAQs with permission-filtered search and deterministic policy checks; adds cited LLM drafts only if the baseline fails. | partner-operations | Desk review | [@daehuikim](https://github.com/daehuikim) |
| [Maintenance request triage](https://github.com/daehuikim/fde-service-template/blob/main/src/fde_workbench/resources/examples/support-triage.en.json) — The bundled example: route maintenance requests to clear owners without automating safety decisions. Run it with fde example support-triage. | customer-support | Synthetic | [@daehuikim](https://github.com/daehuikim) |

[See all 3](SHOWCASE.md) · [Add yours](showcase/README.md)
<!-- showcase:end -->

## Build, test and release

```sh
uv sync --frozen
uv run ruff check src tests
uv run pytest
uv build
uv run twine check dist/*
```

Python CI tests installation and CLI behavior on Linux, macOS and Windows. The release workflow builds wheel/sdist and a versioned skill ZIP; [PyPI trusted publishing](docs/en/releasing.md) uses the configured repository environment and OIDC. The [optional Next.js/PostgreSQL example](docs/en/web-example.md) is separate from the Python package.

[Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) · [Governance](GOVERNANCE.md) · [Code of conduct](CODE_OF_CONDUCT.md) · [Showcase](SHOWCASE.md) · [Security](SECURITY.md) · [License](LICENSE) · [Reference review](docs/product/reference-review.md)
