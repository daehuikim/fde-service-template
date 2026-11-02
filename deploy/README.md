# 배포 runbook

## 경계와 운영 책임

단일 호스트의 Caddy → 비공개 web → 비공개 PostgreSQL을 기본안으로 둡니다. Compose는 검토 가능한 배포 설정이며 이 환경에서 실행되지 않았습니다. 운영 UI 인증은 미구현이므로 공개 사용자용 UI 출시는 보류하고 인증된 API client만 연결하세요. `/api/health`는 프로세스 liveness이며 DB readiness를 보장하지 않습니다.

1. `pnpm qa`와 `pnpm test:db`를 통과시킵니다. 운영 이미지는 테스트된 Git SHA로 build/tag하고 registry의 digest로 고정합니다. 예시 Docker base tag도 release 전 digest로 고정합니다.
2. DB 관리자는 migration용 owner와 runtime용 비 superuser `fde_runtime` 역할을 분리합니다. runtime 역할에는 schema USAGE, runs SELECT/INSERT/UPDATE/DELETE만 부여합니다. `BYPASSRLS`를 금지합니다. `DATABASE_URL`은 secret store에서 주입합니다.
3. 관리 역할의 `DATABASE_URL`로 `pnpm db:migrate`를 실행합니다. migration은 advisory lock과 트랜잭션을 사용합니다. 현재 첫 migration은 새 DB와 동일 버전 재실행만 지원합니다. 다음 변경은 expand/backfill/contract로 추가하세요.
4. `DOMAIN`, `POSTGRES_PASSWORD`, runtime `DATABASE_URL`, `SERVICE_TOKEN`(32 byte 이상), `SERVICE_TENANT`를 서버에 설정합니다. `docker compose -f deploy/compose.yml config --quiet`로 설정을 검사합니다. secret 값을 로그나 Git에 넣지 않습니다.
5. `docker compose -f deploy/compose.yml up -d --build`로 실행합니다. DNS와 TLS 발급을 확인하고 인증된 합성 API 요청으로 저장까지 smoke test합니다.
6. Kubernetes는 `kubernetes/web.yaml`의 제안안을 참고합니다. Ingress/TLS, NetworkPolicy, secret, rollout deadline, pod disruption budget, DB 연결 상한을 환경에 맞게 추가해야 합니다. replica 수 × pool 5가 DB connection budget 안에 들어가야 합니다.

## 실패 · 롤백 · 복구

배포 중 새 인스턴스 readiness와 인증된 smoke test가 실패하면 트래픽 전환을 중단합니다. 직전 image digest로 되돌리되 이전 앱과 호환되는 schema를 유지합니다. 파괴적 down migration을 자동 실행하지 않습니다. DB 복구는 앱 rollback과 별도입니다.

운영 전 암호화된 일별 snapshot + WAL/PITR 보관, 별도 계정/저장소, 보관 기간과 RPO/RTO를 정하고 새 DB로 restore drill을 실행합니다. 현재 백업 자동화는 없습니다. fixture는 로컬 메모리만 사용하고 JSON export만 제공하므로 내구성을 주장하지 않습니다.

## 확장 트리거

지연이 요청 timeout 예산을 넘는 장기 작업이 관측될 때 queue/worker를 도입합니다. 먼저 DB의 job lease, idempotency, cancel/complete 경합 정책을 설계합니다. 캐시는 반복 읽기와 적중률 근거가 있을 때, 서비스 분리는 소유권/배포/확장 요구가 갈릴 때 ADR로 결정합니다.
