# Governance · 운영 원칙

How decisions are made in FDE Workbench, who can make them, and how to take on more responsibility. Day-to-day contribution steps are in [CONTRIBUTING.md](CONTRIBUTING.md) ([한국어](CONTRIBUTING.ko.md)).

이 문서는 누가 무엇을 결정하고, 어떻게 더 큰 역할을 맡는지 정합니다. 기여 절차는 [CONTRIBUTING.ko.md](CONTRIBUTING.ko.md)에 있습니다.

## Roles · 역할

| Role | Who | Can | Expected to |
|---|---|---|---|
| **Contributor** · 기여자 | Anyone who opens an issue, PR, review or showcase entry | Propose changes, review, add showcase entries | Follow the [Code of Conduct](CODE_OF_CONDUCT.md) and [contributing rules](CONTRIBUTING.md) |
| **Triager** · 트리아저 | Regular contributors invited by maintainers (GitHub *Triage* role) | Label, assign, close duplicates, request changes | Keep the issue queue moving; respond to new issues within about a week |
| **Maintainer** · 메인테이너 | Listed below (GitHub *Maintain* or *Write* role) | Approve and merge PRs, cut releases, set showcase `featured` | Review fairly, keep `main` green, uphold project scope |
| **Lead maintainer** · 리드 메인테이너 | Listed below (GitHub *Admin* role) | Repository settings, branch rules, secrets, PyPI publishing, adding or removing maintainers | Make the final call when consensus fails |

## Maintainers

| GitHub | Role | Areas |
|---|---|---|
| [@daehuikim](https://github.com/daehuikim) | Lead maintainer | Everything |

Code ownership by path is in [`.github/CODEOWNERS`](.github/CODEOWNERS). Update both files together when people join or leave.

## How decisions are made · 의사결정

- **Routine changes** (fixes, docs, showcase entries, skill improvements): one maintainer approval and green CI.
- **Significant changes** (new skill, schema or CLI contract change, new dependency, release, policy change): open an issue first and leave it open for at least **3 days** for comment. Lazy consensus: if no maintainer objects, it proceeds.
- **Disagreements**: discuss on the issue with evidence. If maintainers still disagree, the lead maintainer decides and records the reason on the issue.
- **Security and conduct reports** are handled privately, outside this process.

일상 변경은 메인테이너 1인 승인 + CI 통과로 병합합니다. 새 skill, schema·CLI 계약 변경, 새 의존성, 릴리스, 정책 변경은 이슈를 먼저 열어 3일 이상 의견을 받고, 반대가 없으면 진행합니다(lazy consensus). 합의가 안 되면 리드 메인테이너가 근거를 남기고 결정합니다.

## Becoming a triager or maintainer · 역할 확대

- **Triager**: a few months of helpful issues, reviews or PRs. Any maintainer can nominate.
- **Maintainer**: sustained, high-quality contributions and reviews, sound judgment about scope and evidence, and familiarity with the release process. A maintainer nominates on a private channel; the lead maintainer confirms. New maintainers are added to the table above and to CODEOWNERS in a PR.
- Maintainers inactive for 6 months may move to *emeritus* status and can return by asking.

## Protected branch · 보호 브랜치

`main` is always releasable. All changes land through pull requests that pass required checks and code-owner review; force-push and deletion are blocked. The exact rules and how to apply them are in [repository settings](docs/maintainers/repository-settings.md). The lead maintainer may bypass review only through a pull request, for example when they are the sole maintainer and author; CI must still pass and the reason should be in the PR.

## Changing this document

Changes to governance follow the *significant change* process above.
