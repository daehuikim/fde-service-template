<!-- Fill in what applies and delete the rest. · 해당하는 항목만 채우고 나머지는 지워 주세요. -->

## 변경 종류 · Type
- [ ] fix · 버그 수정
- [ ] feat · 기능 / skill
- [ ] docs · 문서
- [ ] showcase · 사용 사례 추가 (아래 Showcase 섹션만 채우면 됩니다)
- [ ] chore / ci · 운영·CI

관련 이슈 · Related issue: #

## 문제와 결과 동작 · Problem and resulting behavior

## 변경 및 설계 근거 · Change and rationale

## 검증 · Verification
- [ ] Python: `uv run ruff check src tests`, `uv run pytest` (패키지 변경 시 build + `scripts/package-smoke.py`)
- [ ] Web/JS: `pnpm qa`, `pnpm eval:fixture`
- [ ] DB/live/load 해당 검사 (pass/fail/not_run/blocked와 이유)
- [ ] Docs/showcase: `node scripts/docs-check.mjs`, `node scripts/showcase.mjs --check`

## Showcase
- [ ] `showcase/entries/<id>.json` 한 파일만 추가했고, `node scripts/showcase.mjs`로 생성 파일을 갱신했습니다.
- [ ] 링크는 공개 자료이며 고객 데이터·비밀값·내부 호스트명이 없습니다.
- [ ] 주장이 `evidence` 수준과 맞습니다(합성·설계 검토 사례는 사업 효과를 주장하지 않음).

## 한계 · 외부 출처 · 보안/데이터 영향 · Limits, sources, security/data impact

---
- [ ] [CONTRIBUTING](https://github.com/daehuikim/fde-service-template/blob/main/CONTRIBUTING.md)과 [행동 강령](https://github.com/daehuikim/fde-service-template/blob/main/CODE_OF_CONDUCT.md)을 읽었습니다. · I read CONTRIBUTING and the Code of Conduct.
