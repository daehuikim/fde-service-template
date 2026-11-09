# ADR 0005 · 토론의 판단은 skill이, 앱은 확인만

상태: 채택 · 2026-11-09 · ADR 0003의 결정 1, 4, 5를 대체

## 배경
ADR 0003·0004의 첫 구현은 앱 안에 규칙 기반 fixture 에이전트(키워드로 주장 생성), 결정적 종합 규칙(반대 1개 이상이면 쟁점, 점수식 정렬), 규칙 기반 goldfish를 두었다. 키 없이 돌아가고 재현되지만, 실제 판단을 코드가 흉내 내므로 현장 문제에서 의미 없는 분류와 순위가 그럴듯하게 보인다. 리드 메인테이너(DH)는 규칙 기반 판단을 걷어 내고 skill을 쓰는 방향으로만 가도록 정했다.

## 결정
1. **모든 판단은 `fde-multi-agent-review` skill의 서브에이전트가 한다.** 관점 탐색(1라운드), 교차 검토(2라운드), 종합(synthesizer 서브에이전트: 분류·순위·이유·결론), goldfish 검증과 판정(3라운드)을 Claude Code·Codex 같은 호스트 어시스턴트가 실행한다.
2. **앱과 CLI는 확인과 표시만 한다.** `discussion.v2` 계약(`packages/contracts/discussion.schema.json`)과 `assertTranscript`가 스키마, 주장·확인 id 소유, 자기 검토·중복 의견, 모든 주장의 분류 여부, 없는 확인 참조, `not_run`·`pass` 일관성을 검사한다. `acceptDiscussion`이 `reportHash`를 다시 계산해 검토 뒤 수정을 거부한다. 무엇이 쟁점인지, 무엇을 먼저 할지는 판단하지 않는다.
3. **앱에서 에이전트를 실행하지 않는다.** `POST /api/discussions`는 `{record}` 가져오기만 받는다(`run:create`). fixture 에이전트, 공급자 인터페이스, NDJSON 실행 스트림, `provider_unavailable`을 제거했다. 화면은 합성 예제 기록(`packages/agents/examples/cvd-particle.discussion.json`)을 불러와 보여 줄 수 있다.
4. **범위.** 제거 대상은 토론의 판단 규칙이다. 스키마·참조 무결성 검사와 CSV 프로필 웹 예제(결정적 계산이지 판단이 아님)는 유지한다.

## 결과
- 제거: `packages/agents/{fixture,samples,goldfish,bounded,index,reviewers}.ts`, `packages/domain/verification.ts`, 이전 `packages/domain/discussion.ts`의 종합 규칙.
- 추가: `packages/agents/record.ts`(`acceptDiscussion`, `reportHash`), `packages/domain/discussion.ts`(기록을 잇는 읽기 전용 view), `pnpm discussion report|check`, synthesizer 프롬프트, 예제 기록.
- 대가: 키 없이 앱에서 토론을 새로 돌려 볼 수 없다. 예제 기록과 skill 실행으로 대신한다. 망 내부 모델로 skill을 돌리는 것과 기록의 DB 영속화는 후속 작업이다.
