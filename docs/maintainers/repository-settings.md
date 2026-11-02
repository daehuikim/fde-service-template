# Repository settings · 저장소 설정

These settings are not stored in git, so this page is the record of what the repository should be configured to. The lead maintainer applies them; anyone can propose a change by PR to this file and to [`.github/rulesets/main.json`](../../.github/rulesets/main.json).

Git에 저장되지 않는 GitHub 설정의 기준 문서입니다. 리드 메인테이너가 적용하며, 변경은 이 파일과 ruleset JSON을 고치는 PR로 제안합니다.

## 1. Protect `main` with a ruleset · main 브랜치 보호

The ruleset in [`.github/rulesets/main.json`](../../.github/rulesets/main.json) targets the default branch and:

| Rule | Effect |
|---|---|
| Restrict deletions | `main` cannot be deleted |
| Block force pushes | History on `main` cannot be rewritten |
| Require a pull request | No direct pushes; 1 approval, **code owner review**, approval of the latest push, stale approvals dismissed on new commits, all review threads resolved; merge commit or squash |
| Require status checks, branch up to date | `core`, `database`, `skill-contract`, `showcase`, and `package` on Ubuntu 3.10/3.12/3.13, macOS 3.12, Windows 3.12 |
| Bypass | Repository **Admin** role, *pull requests only*: lets the sole maintainer merge their own PR without a second reviewer, while direct pushes stay blocked |

Apply it **after** the PR that adds the `showcase` check is merged, otherwise that required check would never report on older branches.

**Option A, web UI (import):** Settings → Rules → Rulesets → *New ruleset* → *Import a ruleset* → choose `.github/rulesets/main.json` → *Create*.

**Option B, GitHub CLI** (needs admin on the repository):

```sh
gh api -X POST repos/daehuikim/fde-service-template/rulesets --input .github/rulesets/main.json
# later updates: find the id, then PUT
gh api repos/daehuikim/fde-service-template/rulesets --jq '.[] | [.id, .name] | @tsv'
gh api -X PUT repos/daehuikim/fde-service-template/rulesets/<id> --input .github/rulesets/main.json
```

When a second maintainer joins, remove the Admin bypass (or keep it for emergencies only) so every change gets an independent review. When a CI job is renamed or the Python matrix changes, update `required_status_checks` in the same PR.

## 2. General · 일반

Settings → General:

- Pull Requests: allow **merge commits** and **squash merging**; disable rebase merging. Enable *Always suggest updating pull request branches* and *Automatically delete head branches*.
- Features: Issues on. Discussions optional (useful for showcase conversations and questions).

## 3. Security · 보안

Settings → Code security:

- **Private vulnerability reporting**: on ([SECURITY.md](../../SECURITY.md) points to it).
- Dependabot alerts and security updates: on. Secret scanning and push protection: on.

## 4. Actions · 액션

Settings → Actions → General:

- Fork pull request workflows from outside collaborators: **Require approval for first-time contributors** (or for all outside collaborators).
- Workflow permissions: **Read repository contents** (workflows already declare `permissions: contents: read`).
- Environment `pypi` (used by publishing): required reviewer = lead maintainer; deployment branches = `main` and release tags only. See [releasing](../en/releasing.md).

## 5. Collaborators and labels · 협업자와 라벨

- Roles follow [GOVERNANCE.md](../../GOVERNANCE.md#roles--역할): Triage for triagers, Maintain/Write for maintainers, Admin for the lead maintainer. Update CODEOWNERS in the same PR.
- Labels used by the issue templates: `bug`, `enhancement`, `needs-triage`, `showcase`, `good first issue`. Create any that are missing (Issues → Labels), otherwise templates cannot apply them.
