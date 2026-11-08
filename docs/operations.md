# 운영 관측과 보안 요구

현재 구현: 입력 200 KB/1,000행 한도, CSV record 크기 한도, request abort 전달, 서버 bearer 검증, production fixture 차단, RLS transaction context, 멱등 키/내용 hash, 공개 데이터 없는 합성 예제. 2026-11-08부터: 사람용 세션 로그인(scrypt 해시, 해시만 저장하는 불투명 토큰, HttpOnly 쿠키, 동일 출처 CSRF 검사, 계정당 로그인 잠금), DB RBAC(`permissions/roles/membership_roles`, `effective_permissions`), 테넌트·소유자 RLS가 걸린 32개 테이블, append-only 감사 로그, 트랜잭션 outbox, `version` 낙관적 잠금, 체크섬 ledger가 있는 forward-only 마이그레이션. 설계 근거는 ADR 0002, 절차는 `.agents/skills/fde-enterprise-stack`.

미구현 운영 게이트: OIDC/SAML SSO·MFA(교체 기준은 skill 참조), 비밀번호 재설정 메일·초대 수락·API 키 발급 UI, outbox/jobs 워커, IP 단위 rate limiting(계정 단위만 구현), 지표/추적 exporter, DB readiness, alert routing, 자동 backup, 취약점 정기 검사. bearer token은 server-to-server/API client용이며 `SERVICE_PERMISSIONS`로 권한 범위를 좁힙니다. 브라우저는 세션 쿠키만 쓰고 localStorage에 자격 증명을 두지 않습니다. RLS는 tenant/소유자 격리이며 인증을 대신하지 않습니다.

운영 시 수집할 지표는 request ID, endpoint, status, duration, schema rejection code, adapter timeout, DB pool wait, retry/conflict 횟수, 로그인 실패/잠금 수, 403/409 비율입니다. 원본 CSV, token, 비밀번호, 세션 쿠키, 요청 제목, DSN은 로그로 남기지 않습니다. 감사 로그(`audit_log`)는 누가·무엇을·언제만 담고 본문을 담지 않습니다. trace/evidence를 클라이언트가 제출해 저장하지 않고 서버가 재검증합니다. 외부 문서·도구 응답은 비신뢰 데이터입니다.

ASVS 매핑(요구사항 선정안): 입력 검증 → contracts/API QA; 인증 → `qa/auth.test.ts`(해시·쿠키·CSRF·잠금) + bearer 경계 테스트; 세션 관리 → 서버 측 폐기, idle/absolute 만료, 해시 저장; 접근 제어 → RBAC 매트릭스 테스트 + PostgreSQL RLS integration(`qa/db.ts` 교차 테넌트); 오류/로그 → generic error, 원본 미기록; 데이터 보호 → 전송 TLS/backup 현장 설정. 특정 ASVS 버전의 번호별 인증을 주장하지 않습니다. 적용 서비스의 버전을 고정하고 실제 증거를 연결한 후 검토하세요.

성능 기준: k6 10 VU/20초/1행 요청, 실패율 <1%, p95 <1초는 초기 smoke gate입니다. 제품 SLO가 아닙니다. 측정 환경·Git SHA·pool wait·데이터 크기별 결과를 별도 기록해야 합니다.
