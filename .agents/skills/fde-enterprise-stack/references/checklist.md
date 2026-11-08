# 출시 게이트 체크리스트

각 항목은 `pass / fail / not_run / blocked`와 근거(명령 출력, 파일, 커밋)를 남긴다. 실행하지 않은 항목을 통과로 쓰지 않는다.

## 인증
- [ ] 비밀번호는 scrypt(N=2^17) 또는 Argon2id로 저장되고 평문·가역 암호가 없다 — `qa/auth.test.ts` "password hashing"
- [ ] 세션 토큰 원문이 DB에 없다 — `qa/db.ts` "raw session token must never be stored"
- [ ] 로그아웃이 서버 측 폐기다 — `revokeSession` 후 `resolveSession` null
- [ ] 로그인 잠금(15분 10회)과 사용자 열거 방지 — 429 테스트
- [ ] 쿠키 `HttpOnly; SameSite=Lax; Secure(https)`, `APP_ORIGIN` 설정 — `deploy/compose.yml`, `kubernetes/web.yaml`

## 권한
- [ ] 모든 쓰기 라우트가 `requirePermission`을 지난다 — `grep -L requirePermission apps/web/app/api/**/route.ts` 결과 검토(auth·health·validate 제외)
- [ ] viewer가 쓰기 403, owner만 `tenant:manage` — `qa/auth.test.ts` "RBAC matrix"
- [ ] 테넌트가 남의 커스텀 역할을 부여할 수 없다 — `qa/db.ts` role_tenant_mismatch

## 데이터
- [ ] 새 테이블마다 `tenant_id`, RLS ENABLE+FORCE, 정책 존재 — `select tablename from pg_tables where schemaname='public' and not rowsecurity` 결과가 전역 테이블뿐
- [ ] 교차 테넌트 읽기 0행, 쓰기 거부 — `pnpm test:db`
- [ ] append-only 테이블 UPDATE 거부 — `pnpm test:db`
- [ ] migration 두 번 실행 멱등, 적용 파일 미수정 — `pnpm db:migrate && pnpm db:migrate`
- [ ] 런타임 역할 비 superuser·NOBYPASSRLS — `pnpm test:db` 첫 assert

## 네트워크·배포
- [ ] Edge 보안 헤더·본문 한도 — `deploy/Caddyfile`
- [ ] DB 포트 비공개, 컨테이너 read-only, cap_drop — `deploy/compose.yml`
- [ ] 비밀값은 secret store, Git·로그·응답에 없음 — `pnpm security:scan`, gitleaks(not_run이면 명시)
- [ ] 커넥션 예산 계산 기록(replicas × 5 ≤ max_connections/2)

## 화면
- [ ] 다섯 상태(로그아웃·403·409·401·성공) 구현 — 컴포넌트와 수동 확인 기록
- [ ] 자격 증명 비저장(localStorage 검색 0건) — `grep -rn localStorage apps/web`
- [ ] 키보드·스크린리더 확인 — not_run이면 명시

## 운영
- [ ] 감사 로그가 생성·수정·세션 이벤트를 담는다 — `qa/db.ts` audit 순서 assert
- [ ] outbox/jobs 워커 배치 계획 또는 미배치 명시
- [ ] 백업·PITR·복구 드릴 — `deploy/README.md` (현재 자동화 없음, not_run)
- [ ] ADR·operations.md·아키텍처 그림 갱신 — `pnpm diagram`
