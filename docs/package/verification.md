# 0.2.0 verification record

Date: 2026-11-02 (Asia/Seoul). Package code tested at `d31a2bc`; subsequent changes only document the verification and complete the Korean API guide.

| Check | Result | Evidence / scope |
|---|---|---|
| Python unit and boundary tests | pass | 43 tests on macOS/Python3.12 locally; repeated by package CI |
| Linux/Python3.10, 3.11, 3.12, 3.13 | pass | Build, metadata check and isolated wheel installation in every matrix job |
| macOS/Python3.12 | pass | Same package workflow, including wheel resources and bilingual CLI |
| Windows/Python3.12 | pass | Same package workflow, including wheel resources and bilingual CLI |
| Portable skill | pass | Frontmatter/reference validation; install/build and file-hash manifest checks |
| Source distribution → wheel | pass | `uv build` builds both distribution forms; twine checks both |
| Installed-wheel smoke | pass | Run outside checkout; en/ko example, check, brief, report, handoff and skill commands |
| Optional web/core QA | pass | 53 JS tests, strict types, production build, contract/diagram checks |
| PostgreSQL CI | pass | Migration, concurrency and isolation checks in the existing DB job |
| Fixture evaluation | pass | 29/29 fixed cases; not a customer-value measurement |
| Product figures | pass | SVG → native resvg PNG; both hero and architecture PNGs visually inspected |
| README/guide links | pass | 11 bilingual/package documents; 55 local links at final documentation review |
| Secrets | pass | Staged and Git-history gitleaks checks; no leaks found |
| PyPI upload / trusted publisher | not_run | Owner-side PyPI/environment configuration required; no upload performed |
| HTML report browser visual/accessibility review | not_run | Escaping/offline structure tested; browser automation not used |
| Independent field/user validation | not_run | Package/review tooling checks do not establish method superiority or business effectiveness |

Package CI: [run 41461307351](https://github.com/daehuikim/fde-service-template/actions/runs/41461307351). Existing core/DB CI: [run 41461307092](https://github.com/daehuikim/fde-service-template/actions/runs/41461307092).

The distribution is a beta package with an MIT license, reproducible content manifests and a tested installation path. It is not a hosted agent service or a guarantee of correctness for an industrial decision. Runtime provider calls and autonomous research remain with the host assistant.
