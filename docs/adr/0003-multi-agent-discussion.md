# ADR 0003 · 멀티 에이전트 병렬 토론 구조

상태: 채택 · 2026-11-08

## 배경
반도체 현장 문제(PM 후 파티클 증가, 식각 CD 드리프트, 폐쇄망 설치 실패 등)는 원인·검증·데이터 경계·배포·비용 관점이 동시에 걸린다. 프로젝트에는 관점별 탐색 skill이 이미 여럿 있지만, 한 에이전트가 차례로 적용하면 첫 가설에 끌려가고 관점 간 반대 의견이 드러나지 않는다.

## 결정
1. **2라운드 프로토콜.** 1라운드는 같은 문제 패킷을 관점별 에이전트에 동시에, 서로 모르게 보낸다(anchoring 방지). 2라운드는 살아남은 에이전트가 다른 관점의 주장에 support / challenge / refine 의견을 낸다. 두 라운드 모두 `Promise.all`로 병렬 실행하고 에이전트별 timeout과 취소를 둔다.
2. **관점 = 기존 skill.** lens id 8개가 `fde-discovery`, `fde-field-debug`, `fde-problem-design`, `fde-validation-review`, `fde-security-review`, `fde-target-env`, `fde-cost-model`, `fde-compat-scale-review`에 1:1로 묶인다(`packages/agents/lenses.ts`).
3. **계약과 무결성.** 에이전트 출력은 비신뢰 데이터다. position·review는 `packages/contracts/discussion.schema.json`을 통과해야 하고, 주장 id는 작성 관점 접두사를 가져야 하며, 자기 주장 검토·중복 의견·없는 주장 참조는 거부된다. 실패한 에이전트는 `failures`에 남고 종합의 coverage에 표시된다.
4. **종합은 결정적 규칙.** `packages/domain/discussion.ts`가 반대 1개 이상 → 쟁점, 지지만 → 합의, 의견 없음 → 단일 관점으로 분류하고, 확인 항목을 쟁점 판별(3) > 합의 확정(2) > 단일 관점(1) + 비용 가산점으로 정렬한다. 모델이 종합 문장을 쓰지 않으므로 모든 줄이 주장 id로 추적되고 재현된다.
5. **공급자 분리.** `AgentProvider` 인터페이스 뒤에 에이전트를 둔다. 템플릿은 키 없이 동작하는 합성 fixture 공급자만 제공한다. 실제 LLM 실행은 호스트 어시스턴트가 `fde-multi-agent-review` skill로 수행하고 transcript를 가져오기(`POST /api/discussions {transcript}`, `pnpm discussion synthesize`)로 넘긴다. live 모드에서 공급자가 없으면 `provider_unavailable`(409)를 돌려준다.
6. **권한.** 실행과 가져오기 모두 `run:create`가 필요하다(viewer 불가).

## 대안과 기각 이유
- 모델이 종합까지 쓰는 "moderator" 에이전트: 읽기 좋지만 합의·쟁점 판정이 재현되지 않고 근거 추적이 끊긴다. 필요하면 결정적 종합 위에 요약 문장만 덧붙인다.
- 순차 체인(한 관점 결과를 다음 관점에 넘김): 앞 관점의 프레임이 뒤 관점을 지배한다. 교차 검토는 독립 탐색 뒤에만 한다.
- 다수 라운드 자유 토론: 비용이 라운드 수×관점 수로 늘고 수렴 기준이 모호하다. 쟁점이 남으면 토론을 늘리지 않고 확인 항목(현장 데이터)으로 판별한다.
- 앱 서버에서 외부 LLM 직접 호출: 기본 policy(외부 전송 금지)와 충돌하고 fab 데이터 반출 위험이 있다. 고객 망 내부 모델 공급자를 등록하는 것은 후속 결정으로 남긴다.

## 결과
- `/discussion` 화면: 관점 선택, 병렬 진행 레인(NDJSON 스트림), 종합(합의도·우선 확인·쟁점·합의), 지지/반대 매트릭스, 관점별 원문, JSON 내보내기, 확인 항목의 작업 항목 등록(`/api/work-items`).
- 테스트: 라운드 순서, 병렬성, timeout·오류·계약 위반 기록, 취소, 참조 무결성, API 권한·live 거부(`qa/discussion.test.ts`).
- 미구현: 망 내부 LLM 공급자, 토론 기록의 DB 영속화(현재는 JSON 내보내기와 작업 항목 등록), 관점별 비용 한도.
