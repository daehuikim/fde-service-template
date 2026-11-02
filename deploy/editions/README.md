# 납품 형태별 선택

| 형태 | UI | API/도구/도메인 | DB | 배포물 | 상태 |
|---|---|---|---|---|---|
| sandbox | 포함 | 포함 | 미사용 | `pnpm dev` | 구현 |
| api | 선택 | 포함 | 선택 | standalone Docker | 공통 앱 구현, 별도 API image 없음 |
| full | 포함 | 포함 | PostgreSQL | Compose + TLS | 설정 제공, 미실행 |
| SaaS | 포함 | 포함 | RLS + tenant | Kubernetes + managed DB | manifest 시작점, 운영 미검증 |
| on-prem | 포함 | 포함 | 내부 PostgreSQL | 동일 Docker image | 네트워크/인증/백업 현장 검토 필요 |

현재 데모 UI는 로컬 fixture 전용입니다. 운영 API는 bearer client용이며 브라우저 사용자 로그인은 아직 구현하지 않았습니다. SaaS/구축형을 완성된 납품물로 표현하지 마세요. agent/MCP 실행 서버는 기본 앱에 넣지 않습니다. 개발 MCP와 제품 런타임을 구분합니다.
