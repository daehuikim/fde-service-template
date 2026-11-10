# 해커톤 스타터 (SQLite, 무설치)

Docker·PostgreSQL 없이 Python 3.10+ 표준 라이브러리만으로 뜨는 로그인·DB 웹서비스 골격이다. `fde-hackathon` 스킬([SKILL.md](../../.agents/skills/fde-hackathon/SKILL.md))의 시작 코드이며, core / api / web 세 층으로 나뉘어 있다. 엔터프라이즈 기능(테넌트, RLS, PostgreSQL)이 필요하면 `apps/web` Next.js 예제를 본다.

## 실행

```sh
sh examples/hackathon/start.sh        # venv → ortools 설치 → DB 초기화·시드 → http://127.0.0.1:8000
```

- 설치가 막혀도(오프라인) `python3 examples/hackathon/server.py`로 로그인·요청·승인은 동작한다. 최적화 API만 비활성.
- DB 위치는 환경 변수 하나: `HK_DB=/path/x.db` (기본 `hackathon.db`, 테스트는 `:memory:`). 지우면 다음 실행 때 다시 시드된다.
- 쿠키는 기본 `Secure`. 로컬 http에서 브라우저가 쿠키를 버리면 `HK_COOKIE_SECURE=0`.
- 시드 계정(비밀번호 `hackathon-demo`): `viewer`(조회자, L1), `engineer`(담당자, L1), `engineer2`(담당자, L2), `lead`(팀장, L1), `admin`(관리자) `@example.com`. 예산 L1 500만 원, L2 300만 원.

## 테스트

```sh
uv run --with ortools --with pytest python -m pytest examples/hackathon/tests
```

ortools가 없으면 솔버 테스트만 건너뛴다.

## 세 층 (core / api / web)

| 층 | 파일 | 하는 일 |
|---|---|---|
| **web** (화면) | `web/index.html` | api만 호출. 공통 `api()` 함수가 401/403/422/500/해 없음/빈 목록을 한곳에서 처리 |
| **api** (얇은 HTTP 층) | `api/app.py` `App.route` | 경로 → 인증(`current_user`) → JSON 파싱 → 도메인 호출 → JSON + 상태 코드 |
| | `api/auth.py` | 세션 확인(401), 역할 → 행위 → 데이터 범위 검사(403) |
| | `api/domain.py` | 요청 생성·승인, 쓰기 직전 예산 검증, `BEGIN IMMEDIATE` 트랜잭션 |
| | `api/db.py` | 스키마, CHECK 제약(예산, 자기 승인 금지), 시드 |
| | `api/errors.py` | 실패 상태 계약(상태 코드와 응답 본문) |
| **core** (순수 파이썬) | `core/assignment.py`, `core/covering.py` | CP-SAT 배정·덮개 골격, 해 없음 완화안, 현행(탐욕) 대비 |
| | `core/checker.py`, `core/budget.py` | 솔버와 독립된 검사기, 예산 규칙 |

core는 웹·DB를 import하지 않는다. 단독 사용 예:

```python
import sys; sys.path.insert(0, "examples/hackathon")
from core import covering
print(covering.solve({"budget": 5, "required_zones": ["Z1"], "sites": [{"id": "C1", "cost": 3, "covers": ["Z1"]}]}).to_json())
```

요청 하나의 경로: `web/index.html` → `api/app.py` → `api/auth.py` → `api/domain.py`(→ `core/`) → `api/db.py` → JSON 응답 → 화면 갱신.

이 스타터는 표준 라이브러리 서버라 FastAPI의 `/docs` 같은 자동 API 명세가 없다. 명세는 아래 목록이 대신한다. 자동 명세가 필요하면 api 층만 FastAPI로 바꾸고 core는 그대로 쓴다.

API: `POST /api/login` · `POST /api/logout` · `GET /api/me` · `GET|POST /api/requests` · `GET /api/requests/{id}` · `POST /api/requests/{id}/approve` · `GET /api/budgets` · `PUT /api/budgets/{line}` · `POST /api/plan/assignment|covering`.
