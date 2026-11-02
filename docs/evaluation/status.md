# 초기 템플릿 검증 · 2026-11-02

검증 대상: `73e2f45` (초기 구현), macOS arm64 / Node 22.17.1 / pnpm 11.25.0.

| 검사 | 상태 | 실제 증거와 범위 |
|---|---|---|
| clean clone install/QA/build | pass | /tmp의 별도 clone, frozen lockfile, 키 없는 QA 39/39 |
| fixture evaluation | pass | 29/29, SHA/dirty/데이터·설정 hash를 reports/fixture.json에 생성 |
| PostgreSQL migration | pass | 임시 PostgreSQL 18.6 binary, 비 superuser, 빈 DB 및 동일 migration 재실행 |
| DB concurrency / isolation | pass | 12개 동시 저장 단일 ID, payload conflict rollback, 다른 tenant 읽기/쓰기 차단 |
| production HTTP smoke | pass | 실제 live DB, 인증 누락 401, 10개 동시 저장 동일 ID, 다른 payload 409 |
| k6 local smoke | pass | v2.3.0, 10 VU/20초, 95,284 requests, 오류 0%, p95 3.68ms, 1행 합성 validate endpoint |
| Semgrep | pass | v1.153.0, 자체 2개 규칙/16개 TS 파일, findings 0; 포괄적 보안 인증 아님 |
| production dependency audit | pass | csv-parse advisory 발견 후 7.0.3으로 갱신, 최종 advisories 0 |
| gitleaks staged | pass | v8.30.1, 초기 추적 파일 1.46 MB, leaks 0 |
| diagram generation/structure | pass | spec/경로/연결/source/output hash 검사 |
| browser/UI/PNG visual review | not_run | restricted profile, 브라우저 실행 안 함 |
| Compose/K8s actual deployment | blocked | Docker daemon 미실행; K8s는 제안안 |
| real user/baseline observation | not_run | human_validation_pending |
| optional MCP connectivity | not_run | 설정과 pin만 제공, 원격 연결 인증 미실시 |

`toolkit_ready=true` (초기 clone 핵심 검증 기준). `service_validated=false`.

부하 수치는 loopback의 매우 작은 작업에 대한 smoke 결과이며 현장 성능/DB 쓰기 부하/SLO를 의미하지 않습니다. 실제 사용자 가치와 산업 문제 해결 능력은 별도 검증이 필요합니다. 다음 단계는 공식 현장 사례 기반 별도 파생 저장소 실험과 공통 부족분 반영입니다.

## 설계 우선 확장 검증

공식 사례 기반의 별도 파생 저장소에서 EV 입지와 파트너 QA의 분석/방법 선택/설계를 검토했다. 제품별 서비스는 구현하지 않았다. 설계별 대안5개·요구5개·시나리오8개·비판 관점4개를 기록했다. 기본 실행 QA39개에 설계 검사/빠른 초안 회귀14개가 추가되어 총53개가 통과했다. 캐시 디렉터리의 테스트를 제외하도록 Vitest 대상을 qa/로 한정했다.

빠른 초안의 본문은 EV435자, QA462자다. 읽기 시간53/56초는 500자/분을 가정한 계산이며 실측이 아니다. 정량 검사는 구조/참조/수치 반례 검산까지이고, 정성은 동일 AI의 self review까지다. 실제 사람의 이해도/유용성, 독립 전문가 검토, 산업 현장 효과는 not_run이다. [검토 결과](../field-validation/qualitative-review.md), [짧은 초안 평가](../field-validation/quick-review.md).
