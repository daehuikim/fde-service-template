# 네트워크·API·화면 규칙

## 요청 경로와 경계
```
브라우저 ──HTTPS(쿠키)──▶ Edge(Caddy: TLS, 헤더, 210KB 본문 한도) ──HTTP──▶ web(Next.js, 비공개) ──SQL(RLS)──▶ PostgreSQL(비공개)
서비스 클라이언트 ──HTTPS(Bearer)──▶ 같은 경로, Principal.kind="service", SERVICE_PERMISSIONS 범위만
```
- `APP_ORIGIN`은 정확한 공개 origin 하나. 쿠키 요청의 모든 변경 메서드는 `Origin`(없으면 `Referer`)이 이와 같아야 한다(`assertSameOrigin`). `Sec-Fetch-Site: cross-site`는 거부.
- Edge 헤더: HSTS, CSP(`default-src 'self'; frame-ancestors 'none'`), `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `Permissions-Policy`. 인라인 스크립트가 필요해지면 nonce 기반 CSP로 바꾼다.
- 속도 제한: 로그인은 DB `login_attempts`(계정당 15분 10회). IP 단위 제한은 edge(Caddy rate_limit 모듈 또는 WAF)에서 추가하고 `rate_limit_buckets`로 API 키 단위 제한을 구현한다.
- DB 포트는 외부 비공개. 앱 컨테이너는 read-only FS, `cap_drop: ALL`, `no-new-privileges`.
- 커넥션: 인스턴스당 pool 5. 수평 확장 전 DB `max_connections`와 PgBouncer를 먼저 결정한다.

## API 계약
| 경로 | 인증 | 권한 | 비고 |
|---|---|---|---|
| `POST /api/auth/login` | 없음(동일 출처) | — | `{email,password,tenant?}` → 세션 쿠키 + `{user,tenant,permissions}` |
| `POST /api/auth/logout` | 쿠키 | — | 서버 측 폐기 후 쿠키 만료 |
| `GET /api/auth/me` | 쿠키 또는 bearer | — | 현재 Principal |
| `GET/POST/PATCH /api/work-items` | 쿠키 또는 bearer | `work_item:read/create/update` | PATCH는 `{id,version,…}` 필수, 불일치 409 |
| `GET/PUT /api/memory` | 쿠키(사용자만) | 공유 쓰기는 `memory:write_shared` | `visibility: private|workspace|tenant` |
| `POST /api/validate`, `POST /api/runs` | bearer/fixture | (기존) | 멱등 키 `key` |

노출 오류 코드(`failure()`): `unauthorized`(401) `forbidden`·`csrf_rejected`·`no_membership`(403) `not_found`(404) `version_conflict`·`idempotency_conflict`·`email_taken`(409) `input_too_large`(413) `too_many_attempts`(429) 그 외 400 `invalid_input`/`tool_failure`. 새 코드는 이 목록에 추가해야만 노출된다.

입력 규칙: `content-type: application/json`, 허용 키 외 거부(`onlyKeys`), 길이·패턴 검증(`string`), 숫자는 정수 범위 검사. 응답은 `cache-control: no-store`.

## 화면 상태 (모든 작업 화면이 구현해야 하는 다섯 상태)
| 상태 | 신호 | 화면 동작 |
|---|---|---|
| 로그아웃됨 | `/api/auth/me` 401 | 로그인 패널. 작성 중 입력은 로컬 상태에 보존 |
| 권한 없음 | 403 `forbidden` | 버튼은 애초에 숨기되, 응답 403이 오면 "권한이 필요합니다"와 요청할 역할 안내 |
| 충돌 | 409 `version_conflict` | 최신 버전을 다시 불러와 diff를 보여주고 사용자가 재적용 |
| 세션 만료 | 401 작업 중 | 입력을 잃지 않고 재로그인 → 같은 요청 재시도 |
| 성공 | 2xx | 결과와 근거(누가·언제·버전) 표시 |

- 토큰은 JS에서 읽을 수 없다(HttpOnly). `localStorage`/`sessionStorage`에 자격 증명을 두지 않는다.
- `fetch`는 기본 same-origin 쿠키를 보내며 `Origin`을 자동으로 넣는다. 외부 도메인에서 호출하는 SPA가 생기면 CORS 대신 같은 origin으로 배치한다.
- 권한 목록은 로그인 응답으로 받아 메뉴 노출에만 쓴다. 서버가 모든 요청에서 다시 판단한다.
- 데모 계정(`owner@example.com`/`viewer@example.com`)은 fixture 모드 전용이며 production에서는 fixture 자체가 차단된다.
