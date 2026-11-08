# 데이터 모델·마이그레이션 규칙

기준: `packages/db/migrations/001`–`005`. 새 테이블은 이 규칙을 따르고, 예외는 ADR로 남긴다.

## 테이블 규칙
1. **테넌트 열.** 테넌트 데이터를 담는 모든 테이블에 `tenant_id text NOT NULL`을 둔다. 전역 테이블(`users`, `permissions`, `schema_migrations` 등)은 ADR에 이유를 적는다.
2. **복합 FK.** 자식 행은 `(tenant_id, parent_id) REFERENCES parent(tenant_id, id)`로 참조한다. 부모에는 `UNIQUE (tenant_id, id)`가 필요하다. RLS가 잘못돼도 다른 테넌트 행을 가리킬 수 없다. (`work_items → workspaces`, `comments → work_items`, `memory_entries → memberships`)
3. **DB가 값 범위를 지킨다.** 길이·형식·열거는 `CHECK`로 쓴다(`status IN (...)`, `key ~ '^[a-z0-9_.-]{1,80}$'`, `pg_column_size(payload) <= 16384`). 애플리케이션 검증은 사용자 메시지를 위한 것이고, 제약은 무결성을 위한 것이다.
4. **이력은 append-only.** `audit_log`, `work_item_events`는 UPDATE를 트리거로 거부하고, RLS에 UPDATE/DELETE 정책을 두지 않는다(기본 거부). 보존 기간 종료 시 삭제는 관리자 역할이 파티션 단위로 한다.
5. **삭제는 soft delete.** 업무 레코드는 `deleted_at`을 쓰고 목록 인덱스는 `WHERE deleted_at IS NULL` 부분 인덱스로 만든다. 하드 삭제(탈퇴·계약 종료)는 `tenants`/`users` cascade로만 일어난다.
6. **동시 수정은 `version`.** `UPDATE ... WHERE id=$1 AND version=$2`로 쓰고, 0행이면 `version_conflict`(409). 트리거 `bump_version`이 증가시킨다.
7. **ID와 시간.** PK는 `uuid DEFAULT gen_random_uuid()`(순서 보장이 중요하면 ULID/UUIDv7 검토), 시간은 항상 `timestamptz`, 이력성 테이블은 `bigint GENERATED ALWAYS AS IDENTITY`.
8. **비밀은 해시만.** 세션 토큰·API 키·초대 토큰·재설정 토큰은 SHA-256 hex(`^[0-9a-f]{64}$` CHECK). 비밀번호는 별도 `user_credentials`에 PHC 문자열로.
9. **JSONB는 한도와 함께.** `pg_column_size` CHECK로 상한을 두고, 조회 조건이 되는 필드는 열로 승격한다.

## 격리 계약 (RLS)
- 세션 변수: `app.tenant`(text), `app.user`(uuid text, 서비스 클라이언트는 빈 문자열). 항상 `set_config(name, value, true)`로 **트랜잭션 로컬**로 설정한다. 커넥션 풀에서 값이 새지 않는다.
- 헬퍼: `app_tenant()`, `app_user()`는 빈 문자열을 NULL로 정규화한다. `current_setting(..., true)`는 한 번 설정된 뒤 `''`를 돌려주므로 직접 쓰지 않는다.
- 정책 이름: 테넌트 경계 `tenant_boundary`, 소유자 경계 `owner_boundary`, 혼합은 `*_read`/`*_write`. 모든 테넌트 테이블은 `ENABLE` + `FORCE`(소유자도 적용).
- 시스템 행: `roles.tenant_id IS NULL`, `feature_flags.tenant_id IS NULL`은 전역 기본값이며, 테넌트 컨텍스트가 없는 migration만 쓴다.
- 운영 역할: migration은 owner 역할, 런타임은 `fde_runtime`(비 superuser, `NOBYPASSRLS`). CI의 `test:db`가 첫 줄에서 이를 검사한다.

## 마이그레이션 규칙
- 파일명 `NNN_snake_case.sql`, 한 파일은 한 트랜잭션, advisory lock `761221`.
- `schema_migrations(version, name, checksum)` ledger. **적용된 파일을 수정하면 체크섬 불일치로 실패한다.** 고칠 것이 있으면 다음 번호로 쓴다.
- 파괴적 변경은 expand(새 열/테이블 추가) → backfill(배치, 잠금 짧게) → contract(옛 열 제거, 최소 한 릴리스 뒤) 세 파일로 나눈다. 앱 롤백은 schema 롤백을 요구하지 않아야 한다.
- 큰 테이블 인덱스는 `CREATE INDEX CONCURRENTLY`를 별도 비트랜잭션 단계로 실행한다(현재 러너는 트랜잭션 안에서 실행하므로 수동 단계로 기록).
- 두 번 실행해 같은 결과(멱등)여야 한다: `pnpm db:migrate && pnpm db:migrate`.

## 확장성 규칙
- 커넥션 예산: `replicas × pool(max=5)` ≤ DB `max_connections`의 절반. 넘으면 PgBouncer(transaction pooling) 도입. 트랜잭션 로컬 `set_config`는 transaction pooling과 호환된다.
- 목록 쿼리는 `(tenant_id, …, updated_at DESC)` 복합 인덱스 + keyset pagination. `OFFSET` 금지.
- 비동기 작업은 `jobs`(SKIP LOCKED lease) 또는 `outbox_events`(같은 트랜잭션에 기록, 워커가 전달). HTTP 요청 안에서 외부 호출을 기다리지 않는다.
- 파티셔닝 트리거: `audit_log`/`work_item_events`가 월 1천만 행을 넘거나 보존 삭제가 1분을 넘을 때 월 단위 range partition.
- 읽기 분리는 복제 지연을 허용하는 화면(대시보드)에만. 쓰기 직후 읽기는 primary.

## 테이블 목록 (32)
| migration | 테이블 | 격리 |
|---|---|---|
| 001 | runs | tenant |
| 002 | users, user_credentials, sessions, password_resets, login_attempts | 전역(인증 모듈 전용) · api_keys | tenant |
| 003 | tenants, permissions, role_permissions | 전역 · memberships, roles, membership_roles, invitations | tenant(+본인 행) |
| 004 | workspaces, work_items, work_item_events, tags, work_item_tags, comments, attachments | tenant · memory_entries | tenant+가시성 · saved_views, user_preferences | 소유자 |
| 005 | audit_log(읽기 tenant, 쓰기 tenant/NULL), outbox_events, jobs, idempotency_keys, tenant_settings | tenant · feature_flags | tenant+전역 · rate_limit_buckets | 전역 |
| runner | schema_migrations | 전역 |
