# Add a showcase entry · 사용 사례 추가하기

The [showcase leaderboard](../SHOWCASE.md) and the README "Showcase" section are generated from one JSON file per case in [`entries/`](entries). To add yours, open a pull request that adds **one file**.

[리더보드](../SHOWCASE.md)와 README의 사용 사례 섹션은 [`entries/`](entries)의 사례별 JSON 파일에서 생성됩니다. **파일 하나**를 추가하는 PR을 올리면 됩니다.

## Steps · 절차

1. Copy an existing entry to `showcase/entries/<id>.json`. The file name must equal `id` (kebab-case).
2. Fill in the fields below. Link to material that is **public** and that you may share.
3. Run `node scripts/showcase.mjs` to regenerate `SHOWCASE.md` and the README blocks. No install is needed.
4. Run `node scripts/showcase.mjs --check`, commit the entry and the regenerated files, and open a PR using the template.

Not comfortable with a PR? Open a [showcase issue](https://github.com/daehuikim/fde-service-template/issues/new?template=showcase.yml) and a maintainer will add it.

## Fields · 항목

| Field | Required | Rule |
|---|---|---|
| `id` | yes | kebab-case, ≤ 60 chars, equals the file name |
| `title` / `title_ko` | yes / no | ≤ 80 chars, one line |
| `summary` / `summary_ko` | yes / no | ≤ 200 chars, one line: the problem, the choice made and why |
| `url` | yes | https link to the write-up, design, repo or report |
| `source` | no | https link to code or data behind it |
| `authors` | yes | GitHub logins without `@` |
| `date` | yes | `YYYY-MM-DD` of the work or publication |
| `domain` | yes | one of `energy`, `mobility`, `customer-support`, `partner-operations`, `logistics`, `manufacturing`, `finance`, `healthcare`, `public-sector`, `retail`, `education`, `developer-tools`, `other` |
| `evidence` | yes | `production`, `pilot`, `desk-review` or `synthetic` (see below) |
| `skills` | yes | names of directories in [`.agents/skills`](../.agents/skills/README.md) that you used |
| `language` | yes | language of the linked material: `en`, `ko` or `en+ko` |
| `featured` | no | **maintainers only**. Contributors leave it out |

The editor-friendly schema is [`schema.json`](schema.json). CI runs the same validation as `--check`.

## Evidence level · 근거 수준

Pick the level the linked material actually demonstrates. It is not a quality score.

| Level | Means |
|---|---|
| `production` | Used in real operation; the link shows what changed and how it was measured |
| `pilot` | Tried with real users or data in a bounded trial |
| `desk-review` | A design or analysis built from real sources, not yet tried in operation |
| `synthetic` | Built on mock or example data to show the method |

## Ranking · 순위

Maintainer picks (⭐) first, then evidence level, then the newest date. The README shows the top 5. Maintainers may set `featured` on cases that are well evidenced, reusable and clearly written.

## What we accept · 등록 기준

- Public, shareable material. **No customer data, secrets, internal hostnames or non-public logs** in the entry or the link.
- Claims match the evidence level. A synthetic or desk-review case does not claim business impact.
- The case used FDE Workbench or a skill from this repository in a meaningful way.
- One case per file; updates to your own entry are welcome.

Maintainers may decline or remove an entry that breaks these rules or whose link has gone dead.
