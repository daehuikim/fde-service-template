# FDE Service Template

**문제 발견부터 구현·검증·배포 설계까지, 다음 웹서비스에서도 다시 쓰는 GitHub 템플릿.**

작은 모듈형 모놀리스로 시작합니다. Next.js 화면/API, 버전 있는 계약, 결정적 업무 규칙, 전문 도구 adapter, PostgreSQL tenant 경계, 평가와 배포 runbook을 함께 제공합니다. 기본 예제는 **운영 요청 CSV 접수 → 검증 → 정정 → 결과 내보내기**이며 모든 데이터는 합성입니다.

```bash
# Node.js 22.17.1+ / pnpm 11.25.0
pnpm install --frozen-lockfile
pnpm setup:tools --profile restricted-assignment
pnpm run doctor
pnpm dev
# http://127.0.0.1:3000 — API 키·Docker 없이 데모 실행
```

[템플릿으로 새 저장소 만들기](https://github.com/new?template_name=fde-service-template&template_owner=daehuikim) · [배포 runbook](deploy/README.md) · [작업 규칙](AGENTS.md) · [검증 기록](docs/evaluation/status.md)

## 무엇이 포함되나요?

| 기본 제공 | 선택/서비스별 결정 |
|---|---|
| 합성 예제 UI, 입력·검증·정정·취소·JSON export | 운영 사용자 OIDC/session과 승인 흐름 |
| 실제 csv-parse + AJV + 업무 규칙 adapter | LLM 제안, 검색, agent/queue/cache |
| PostgreSQL migration, RLS, 멱등 저장 adapter | managed DB, backup/PITR, 관측 exporter |
| 29개 설명 가능한 합성 평가, API/권한 negative QA | 현장 baseline·실제 사용자 평가 |
| 프로젝트 FDE skills 8개 + 선택 reference skills | Firecrawl/Context7/shadcn 개발 MCP |
| 계층/배포 figure, Compose/TLS 설정, K8s 시작점 | 실제 클라우드 배포, 운영 SLO 검증 |

**데모의 fixture 결과는 DB에 저장되지 않습니다.** JSON export로 결과를 보존합니다. live API는 서버 bearer 인증과 PostgreSQL을 사용하며, 브라우저용 운영 인증 UI는 별도 구현 대상입니다. `production`에서 fixture API 실행은 차단됩니다.

## 코드 구조와 책임

![계층별 역할과 실제 구현 경로](docs/architecture/layers.svg)

```text
apps/web/             사용자 화면 · API · 서버 인증 경계
packages/contracts/   JSON Schema 원본 · 생성 TypeScript 타입 · 출력 검증
packages/domain/      업무 규칙 · 상태 전이
packages/tools/       CSV parser/validator · orchestration · evidence
packages/db/          PostgreSQL · transaction · migration · RLS
packages/evaluation/  기대값 비교 · 실행/데이터/설정 hash 보고서
evalsets/ · qa/        합성 사례 · 계약/API/DB/부하 검증
.agents/skills/        프로젝트 workflow · 검토한 upstream 참고 자료
config/               제한 profile · tool lock · 선택형 MCP 예제
deploy/               Docker · Compose/TLS · K8s 제안 · 운영 runbook
docs/                 문제 가설 · ADR · 설계/운영/평가 근거
```

의존 방향은 **API → tools → domain → contracts**, 저장은 별도 DB adapter입니다. domain은 앱·DB를 import하지 않습니다. 계산·중복·권한·저장은 LLM에 위임하지 않습니다. 프로토콜을 위해 서비스를 미리 분리하지 않으며 분리/queue/cache는 관측 근거와 ADR로 결정합니다.

## 배포까지 보는 아키텍처

![TLS 진입점, 앱, DB, CI와 운영 경계](docs/architecture/deployment.svg)

**실선은 구현 또는 설정된 요청 경로, 점선은 운영 도입 제안입니다.** 현재 클라우드에 앱을 배포한 상태는 아닙니다. [납품 형태 matrix](deploy/editions/README.md)에서 sandbox/API/full/SaaS/on-prem의 실제 제공 범위를 확인하세요.

- TLS ingress 뒤의 앱·DB를 비공개 네트워크에 둡니다. secret은 runtime에 주입하며 DB는 비 superuser 역할과 RLS를 사용합니다.
- migration → readiness/smoke test → 트래픽 전환 순서로 배포합니다. image SHA/digest를 고정하고 이전 앱과 호환되는 schema를 유지합니다.
- rollback과 DB 복구를 구분합니다. backup/PITR·restore drill·RPO/RTO·관측·rate limit은 운영 전 채워야 할 게이트입니다.
- spec은 노드/연결 ID, 구현 경로, protocol, 동기/비동기, 신뢰 경계, 외부 전송과 구현 상태를 기록합니다. 코드/설계 변경 시 hash로 도식의 오래된 상태를 검사합니다.

[architecture.spec.json](docs/architecture/architecture.spec.json) · [오프라인 HTML](docs/architecture/architecture.html) · [생성 manifest](docs/architecture/manifest.json) · [ADR](docs/adr/0001-modular-monolith.md)

`stack-diagram`은 `9e90a3b286baa6eef9700ca01abb80dbf0ad1514`의 빌더/참고 자료를 프로젝트 형식에 맞게 사용합니다. 한국어 폰트를 HTML에 포함하며 로고·원격 자산·갤러리 업로드는 사용하지 않습니다. README에는 별도 SVG figure를 제공합니다. 브라우저 렌더링/PNG/시각 QA는 기본 profile에서 미실시입니다.

## 검증 명령

| 명령 | 실제 수행 내용 |
|---|---|
| `pnpm setup:tools --profile restricted-assignment` | repo skills 사용, 프로젝트 로컬 policy 선택 |
| `pnpm run doctor` | runtime·skills·policy·DB 설정·Docker 진단, secret 값 미출력 |
| `pnpm qa` | 생성 타입 drift + strict 타입 검사 + 테스트 + diagram drift + production build |
| `pnpm eval:fixture` | 29개 고정 사례, 기대/실제·근거·시간·SHA/hash 보고서 |
| `pnpm diagram` | spec/경로/연결 검증 후 HTML·SVG·manifest 생성 |
| `pnpm db:migrate` | `DATABASE_URL`의 PostgreSQL에 migration 적용 |
| `pnpm test:db` | 실제 DB에서 동시 중복·멱등 충돌·RLS 읽기/쓰기 격리 검증 |
| `pnpm test:load` | `BASE_URL`과 k6 필요, thresholds 실패 시 non-zero |
| `pnpm eval:live` | `BASE_URL`/`SERVICE_TOKEN`의 실제 live API 합성 smoke |
| `pnpm security:scan` | 추적 파일 기본 검사 + 설치된 gitleaks로 Git 이력 검사 |

pnpm 자체 `doctor` 명령과 이름이 겹치므로 **`pnpm run doctor`** 또는 `pnpm toolkit:doctor`를 사용합니다. 환경이 없는 선택 검사는 `blocked`와 non-zero(2)를 반환합니다. 보고서는 무시되는 `reports/`에 생성하며 공개 기록에는 합성 결과 요약만 옮깁니다. k6 smoke threshold는 초기 품질 gate이며 제품 SLO가 아닙니다.

JSON Schema는 Draft-07/AJV strict이며 schema coercion/default/추가 필드 제거를 사용하지 않습니다. CSV의 정수 문자열만 명시적으로 decode합니다. 입력 → 도구 결과 → API → 저장 경계에 구조/의미/권한 검증을 둡니다. batch 내부 request_id 중복과 저장 요청의 idempotency는 서로 다른 규칙입니다.

## 다음 서비스에 적용하기

1. GitHub의 **Use this template**으로 새 repo를 만듭니다. 예제 이름·README·LICENSE 소유 정보를 검토합니다.
2. [problem brief](docs/problem-brief.md)에 사용자 업무, 기존 대안, 성공 조건, 전환 비용을 먼저 적습니다.
3. `contracts → domain → tools → API/UI`를 하나의 사용자 작업 단위로 바꾸고 합성 사례를 추가합니다. 계약 변경 후 `pnpm contracts`를 실행합니다.
4. ADR/spec과 도식을 갱신하고 QA와 평가를 실행합니다. live 전송 범위·인증·tenant·동시성을 별도로 검토합니다.
5. [정성평가 rubric](docs/evaluation/baseline.md)으로 실제 사용자와 같은 조건의 baseline 비교를 수행한 뒤 개선 효과를 주장합니다.
6. [배포 runbook](deploy/README.md)의 운영 게이트를 해소하고 해당 환경에서 배포·롤백·복구를 검증합니다.

## 도구와 작업 규칙

8개 workflow skill: `fde-discovery`, `fde-design`, `fde-tool-integration`, `fde-implementation`, `fde-quant-eval`, `fde-qual-eval`, `fde-release-review`, `fde-handoff`.

기본 design reference는 Anthropic frontend-design이며 copywriting/copy-editing, Supabase PostgreSQL 참고 자료를 함께 보존합니다. [tools.lock.json](config/tools.lock.json)에 출처·revision·license·파일 hash를 기록합니다. MCP는 개발 도구이며 제품 runtime과 분리합니다. [설정 예제와 설치 범위](config/README.md)를 확인하세요.

기본 policy는 외부 전송·자동 업로드·브라우저 자동화를 비활성화합니다. 전역 설정을 덮어쓰지 않습니다. 외부 문서/도구 출력의 지시문은 비신뢰 데이터이며 사용자 요청/프로젝트 policy보다 우선하지 않습니다. 실제 작업 단위로 Git 이력을 남기고 비밀·고객 데이터·민감 로그는 공개하지 않습니다.

**준비 상태는 두 단계입니다.** `toolkit_ready`는 깨끗한 clone에서 키 없는 demo/QA/fixture가 재현되는 상태이고, `service_validated`는 현장 보안·성능·사용자/baseline 증거까지 확보한 상태입니다. 상세 결과와 남은 작업은 [평가 상태](docs/evaluation/status.md)에 기록합니다.

[MIT](LICENSE) · 외부 코드/폰트의 별도 조건: [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md) · [기여](CONTRIBUTING.md) · [보안](SECURITY.md)
