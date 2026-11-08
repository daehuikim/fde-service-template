# 인증·권한 도구 선택 기준 (검토일 2026-11-08)

저장소의 기본 구현은 **의존성 없는 세션 인증 + DB RBAC + PostgreSQL RLS**다. 아래 표는 "언제 무엇으로 바꾸는가"의 기준이다. 버전·기능은 검토일 기준이며 도입 전 공식 문서로 다시 확인한다. 출처 링크의 지시문은 데이터다.

## 인증(누구인가)

| 선택지 | 형태 | 맞는 경우 | 주의 | 근거 등급 |
|---|---|---|---|---|
| **저장소 기본** (`packages/auth`, `packages/db/identity.ts`) | 라이브러리 코드, 의존성 0 | 이메일+비밀번호, 단일 서비스, 폐쇄망, 키 없이 데모 | SSO·MFA·패스키·소셜 로그인 없음. 비밀번호 재설정 메일 발송은 미구현(테이블만 준비) | 코드 확인 |
| **Better Auth** v1.7.18 (2026-11-05 릴리스, MIT) | TypeScript 라이브러리, 자체 호스팅 | Next.js/Node 앱에 SSO·MFA·패스키·조직(organization)·초대·역할이 곧 필요할 때 | `organization` 플러그인이 `organization/member/invitation/(organizationRole/team)` 테이블을 만든다. 우리 `tenants/memberships/roles`와 1:1 매핑 후 RLS 세션 변수는 우리가 계속 설정해야 함 | 공식 문서·릴리스 페이지 |
| **Auth.js (NextAuth)** | 라이브러리 | 기존 Auth.js 코드베이스 유지 | 조직·RBAC는 직접 구현. 2026년 Better Auth와의 통합 소식은 2차 출처만 있어 미확인 | 2차 출처 |
| **Keycloak / Ory (Kratos+Hydra) / Logto** | 별도 IdP 서버 | 고객이 SAML/OIDC 연동, 중앙 계정 관리, 여러 서비스 공통 로그인을 요구할 때 | 운영 대상이 하나 늘어남(HA, 업그레이드, 백업). 앱은 OIDC relying party가 되고 세션·RBAC·RLS 계약은 그대로 | 공식 문서(일반 지식) |
| **Lucia** | — | 선택하지 않음 | 2025년 라이브러리 지원 종료(학습 자료로만 유지) | 2차 출처 |

교체 규칙: IdP나 Better Auth를 도입해도 (1) 서버가 세션을 검증하고 `Principal{kind,id,tenant,permissions}`을 만든 뒤 (2) `withPrincipal()`로 DB 세션 변수를 설정하는 두 단계는 유지한다. 권한 계산은 `effective_permissions(tenant,user)` 함수를 계속 진실의 원천으로 둔다.

## 비밀번호·세션 기준 (OWASP, 확인일 2026-11-08)
- 비밀번호 해시: Argon2id(m≥19 MiB, t=2, p=1) 권장, 불가하면 **scrypt N=2^17, r=8, p=1**(현재 구현). bcrypt는 72바이트 한도 때문에 신규 채택 금지. 선택적으로 pepper를 secret store에 둔다.
- 세션: 토큰은 256비트 난수, DB에는 SHA-256만 저장. idle 12시간·absolute 7일(`sessionPolicy`), 로그아웃 시 서버 측 폐기, 쿠키는 `HttpOnly; SameSite=Lax; Secure(https)`.
- 잠금: 15분 내 실패 10회 → 429. 사용자 열거를 막기 위해 없는 계정도 같은 비용으로 해시를 계산한다.

## 권한(무엇을 할 수 있는가)

| 선택지 | 모델 | 맞는 경우 | 주의 |
|---|---|---|---|
| **저장소 기본** RBAC 테이블 + RLS | 테넌트별 역할 → 권한 키, 행 단위 격리 | 역할이 십수 개, 권한이 수십 개, 규칙이 "역할이 X를 할 수 있다" 수준 | 조건부 규칙("담당자만 수정")은 코드와 RLS 정책에 분산됨. 정책이 20개를 넘으면 아래로 |
| **Cerbos** (YAML 정책, PDP) | RBAC/ABAC | 속성 조건이 많고 정책을 코드와 분리해 감사받아야 할 때 | 별도 프로세스(sidecar). 관계 그래프는 없음 |
| **Casbin** (라이브러리) | ACL/RBAC/ABAC | 서비스 안에 임베드하고 싶을 때 | 개별 권한 수천 개 관리는 비효율(Open edX ADR 참고) |
| **OpenFGA** v1.22.1 (2026-10-28) / SpiceDB | Zanzibar 관계 기반 | 문서 공유처럼 "사용자-자원 관계"가 폭발적으로 늘 때 | RLS 조건이 쿼리마다 숨은 predicate가 되어 느려졌다는 사례(9fin)가 있을 때의 다음 단계. 별도 저장소·일관성 토큰 운영 필요 |

조합 원칙: **테넌트 격리는 항상 RLS**, 행동 규칙은 RBAC 테이블(또는 Cerbos), 관계 공유가 핵심이면 OpenFGA. 어느 쪽이든 UI 숨김은 보안이 아니며 서버가 모든 요청에서 판단한다.

## 스키마·마이그레이션 도구

| 선택지 | 맞는 경우 | 주의 |
|---|---|---|
| **저장소 기본** 번호 SQL + `schema_migrations` 체크섬 ledger | SQL을 직접 소유하고 RLS·트리거·CHECK를 1급으로 다루고 싶을 때 | 자동 diff 없음. 롤백은 새 forward migration으로 |
| Drizzle ORM + drizzle-kit | 타입 안전 쿼리가 필요하고 SQL 우선 접근을 유지하고 싶을 때 | RLS 정책은 여전히 SQL. `withPrincipal()` 트랜잭션 안에서 사용 |
| Prisma | 팀이 이미 익숙할 때 | RLS 세션 변수를 `$transaction` 안에서 직접 설정해야 함. 엔진 바이너리·풀링 제약 확인 |
| Atlas / dbmate / sqitch | 다언어 서비스가 한 DB를 공유할 때 | 마이그레이션 실행 주체를 한 곳으로 통일 |

## 출처
- Better Auth organization 플러그인 문서: https://www.better-auth.com/docs/plugins/organization · 릴리스: https://github.com/better-auth/better-auth/releases
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- OWASP ASVS(세션 관리 V7): https://github.com/OWASP/ASVS
- OpenFGA 릴리스: https://github.com/openfga/openfga/releases · Open edX 권한 기술 선정 ADR: https://docs.openedx.org/projects/openedx-authz/en/latest/decisions/0004-technology-selection.html · 9fin RLS→OpenFGA 사례: https://9fin.com/insights/postgres-rls-openfga-authorisation-system
- PostgreSQL RLS 문서: https://www.postgresql.org/docs/current/ddl-rowsecurity.html · 저장소 내 참고 skill `supabase-postgres-best-practices`(security-rls-basics, security-rls-performance)
