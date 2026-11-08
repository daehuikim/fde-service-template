# ADR 0002 · 인증·권한·테넌트 데이터 모델

상태: 채택 · 2026-11-08

## 배경
ADR 0001의 모듈형 모놀리스는 서비스 토큰 하나와 `runs` 테이블 하나로 동작했다. 엔터프라이즈 배포는 사람 로그인, 역할별 권한, 테넌트 격리, 사용자별 작업 기억, 감사 추적을 요구하고, 이 요구는 프론트·API·네트워크·DB에 동시에 걸린다.

## 결정
1. **인증은 서버 세션.** 이메일+비밀번호(scrypt N=2^17, OWASP 기준), 256비트 불투명 토큰을 SHA-256으로만 저장, HttpOnly 쿠키, 동일 출처 검사로 CSRF 차단, 계정당 로그인 잠금. 외부 라이브러리 없이 `packages/auth`에 둔다. SSO·MFA·패스키가 필요해지면 Better Auth 또는 OIDC IdP로 교체하되 `Principal` 계약과 세션 변수 계약은 유지한다(`.agents/skills/fde-enterprise-stack/references/auth-options.md`).
2. **권한은 DB의 RBAC 테이블.** `permissions(resource:action)` → `roles`(시스템 역할 owner/admin/member/viewer + 테넌트 커스텀 역할) → `membership_roles`. 유효 권한은 `effective_permissions(tenant,user)`가 계산하고 요청당 한 번 Principal에 싣는다. 라우트는 `requirePermission`만 호출한다.
3. **격리는 PostgreSQL RLS.** 모든 테넌트 테이블은 `tenant_id` + `FORCE ROW LEVEL SECURITY`. 자식 테이블은 `(tenant_id, id)` 복합 FK. 소유자 전용 행(`memory_entries` private, `saved_views`, `user_preferences`)은 `app_user()` 조건을 더한다. 세션 변수는 트랜잭션 로컬로만 설정한다.
4. **무결성은 제약으로.** CHECK·복합 FK·append-only 트리거·`version` 낙관적 잠금·트랜잭션 outbox·멱등 키 테이블. 마이그레이션은 forward-only, 체크섬 ledger로 적용 파일 수정을 거부한다.
5. **fixture 모드는 같은 계약의 메모리 구현.** 키·DB 없이 권한 매트릭스와 화면 상태를 테스트하고, production에서는 차단된다.

## 대안과 기각 이유
- 처음부터 Better Auth 도입: 조직·역할 테이블을 라이브러리가 소유하게 되어 RLS 계약과 이중 관리가 생기고, 템플릿이 키 없이 동작한다는 원칙이 약해진다. 요구가 생길 때 매핑 표를 따라 도입한다.
- JWT 무상태 세션: 즉시 폐기가 불가능하고 권한 변경 전파가 늦다. 서버 세션 + DB 조회(요청당 1회)로 충분하며 pool 안에서 저렴하다.
- 애플리케이션 계층만의 테넌트 필터: 한 번의 누락이 데이터 유출이 된다. RLS는 쿼리 누락에도 경계를 지킨다.
- 처음부터 OpenFGA/Cerbos: 현재 규칙은 역할 수준이다. 조건부 정책이 20개를 넘거나 관계 공유가 핵심이 되면 재검토한다.

## 결과
- 테이블 32개, 역할 4종, 권한 19개. 교차 테넌트 읽기·쓰기 실패, append-only, 잠금, 세션 폐기는 `pnpm test:db`가 실제 PostgreSQL에서 검증한다.
- 미구현: 비밀번호 재설정 메일 발송, 초대 수락 흐름, API 키 발급 UI, outbox/jobs 워커, IP 단위 속도 제한, 백업 자동화. 테이블과 계약은 준비돼 있고 `docs/operations.md`에 게이트로 남긴다.
