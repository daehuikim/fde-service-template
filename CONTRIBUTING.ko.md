# 기여 가이드

[English](CONTRIBUTING.md) · [한국어](CONTRIBUTING.ko.md)

기여해 주셔서 고맙습니다. 이 문서는 아이디어가 병합되기까지의 흐름을 설명합니다. 누가 무엇을 결정하는지는 [GOVERNANCE.md](GOVERNANCE.md)에, 모든 참여자가 지킬 규칙은 [행동 강령](CODE_OF_CONDUCT.md)에 있습니다.

## 기여 방법

| 하고 싶은 일 | 방법 |
|---|---|
| 버그 신고 | [버그 리포트](https://github.com/daehuikim/fde-service-template/issues/new?template=bug_report.yml)에 명령, 버전, 출력 첨부 |
| 기능·새 skill 제안 | 먼저 [기능·skill 제안](https://github.com/daehuikim/fde-service-template/issues/new?template=feature_request.yml)으로 문제에 합의한 뒤 코드 작성 |
| 좋은 사용 사례 공유 | PR로 [쇼케이스 항목](showcase/README.md) 추가, 또는 [사례 이슈](https://github.com/daehuikim/fde-service-template/issues/new?template=showcase.yml) 등록 |
| 문서·작은 버그 수정 | 바로 PR |
| 보안 취약점 | **이슈로 올리지 마세요.** [SECURITY.md](SECURITY.md)를 따릅니다 |

`good first issue` 라벨은 처음 참여하는 분에게 맞춘 작업입니다. 큰 작업은 시작 전에 이슈에 댓글을 남겨 중복을 피해 주세요.

## 작업 흐름

1. 저장소를 fork합니다(메인테이너는 이 저장소의 브랜치 사용 가능). 브랜치 이름은 변경 성격대로 `feat/…`, `fix/…`, `docs/…`, `skill/…`, `showcase/…`.
2. PR 하나에 변경 하나. 새 추상화나 의존성을 넣기 전에 문제와 관찰 가능한 동작을 먼저 설명합니다.
3. 실제 작업 단위의 작은 [Conventional Commits](https://www.conventionalcommits.org/)를 씁니다: `feat(skill): …`, `fix(cli): …`, `docs: …`.
4. 바꾼 영역의 검사(아래)를 돌리고 템플릿에 맞춰 `main` 대상 PR을 엽니다.
5. CI 통과와 [code owner](.github/CODEOWNERS) 승인이 필요하고, 리뷰 스레드를 모두 해결해야 합니다. 병합은 메인테이너가 하며 `main`에 직접 push하지 않습니다.

`main`은 보호됩니다: 직접 push·force-push·삭제가 막혀 있고 병합에는 리뷰와 검사 통과가 필요합니다. [저장소 설정](docs/maintainers/repository-settings.md)을 참고하세요.

## 검사

Python 패키지(`src/fde_workbench`):

```sh
uv sync --frozen
uv run ruff check src tests
uv run ruff format --check src tests
uv run pytest
uv build
uv run twine check dist/*
uv run python scripts/package-smoke.py
```

`packages/contracts`의 schema, Python 리소스, skill reference는 같이 맞춥니다(parity 테스트가 검사). 새 리소스는 checkout 밖에 설치한 wheel에서도 동작해야 합니다. 동작이 바뀌면 두 언어 예제와 두 README를 함께 고칩니다.

Skill(`.agents/skills`): [skill 목록](.agents/skills/README.md)에 행을 추가합니다. 설치형 `fde-workbench` skill을 고치면 `src/fde_workbench/resources/skill`과 저장소 사본을 함께 고치고 manifest를 다시 만듭니다.

JS/웹 예제: `pnpm qa`, `pnpm eval:fixture`. DB 변경은 실제 DB 테스트가 필요합니다. 소스·스크립트·워크플로를 바꾸면 `pnpm qa` 전에 `pnpm diagram`을 실행합니다.

쇼케이스·문서만 바꿨다면: `node scripts/showcase.mjs --check`, `node scripts/docs-check.mjs` (설치 불필요).

## 기본 규칙

- 원 출처의 라이선스와 출처 표기를 보존합니다.
- 비밀값, 고객 데이터, 내부 호스트명, 비공개 로그를 커밋·이슈·쇼케이스 링크에 넣지 않습니다.
- 출처 참조 검사나 합성 테스트를 사업 효과의 증거처럼 쓰지 않습니다.
- 공유 브랜치를 force-push하거나 다른 사람이 의존하는 이력을 다시 쓰지 않습니다.
- AI 도움을 받은 기여도 환영합니다. 제출한 모든 줄은 기여자가 책임지고 설명할 수 있어야 합니다.

기여물은 [MIT 라이선스](LICENSE)로 배포되는 데 동의한 것으로 봅니다.
