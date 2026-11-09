# ADR 0004 · Elephant-Goldfish 검증 라운드

상태: 채택 · 2026-11-09 · 실행 주체는 [ADR 0005](0005-skill-only-judgment.md)를 따른다

## 배경
ADR 0003의 토론은 관점 간 anchoring을 줄였지만, 종합 보고서를 쓰는 오케스트레이터는 모든 맥락을 가진 채 자기 결과를 본다. 맥락이 많은 쪽은 보고서에 빠진 전제, 정의 없는 용어, 판별 수단이 없는 쟁점을 "이미 아는 것"으로 넘긴다. Google이 2026년에 공개한 [Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model)(Apache-2.0)은 이 문제를 역할 분리로 다룬다. 맥락을 가진 elephant가 문서를 쓰고, 이전 대화 없이 문서와 참조 자료만 받는 goldfish 검토자들이 병렬로 지적하며, 사람이 무엇을 반영할지 정한다.

## 결정
1. **3라운드 = goldfish 검증.** 종합 뒤 `pnpm discussion report`가 기록을 Markdown 보고서로 렌더링한다. 같은 기록은 항상 같은 보고서가 되므로 SHA-256(`reportHash`)으로 무엇을 검토했는지 고정한다. goldfish에게는 보고서와 문제 패킷만 넘기고 토론 기록·대화는 주지 않는다.
2. **검토자 5종은 모두 skill의 서브에이전트.** `structural`, `comprehension`, `zoom-out`, `design-critic`, `implementation-readiness`. 이름과 관점은 `packages/agents/lenses.ts`의 `goldfishCatalog`, 프롬프트는 `fde-multi-agent-review` skill의 `references/prompts.md`에 있다. 앱 안에 규칙 기반 검토자를 두지 않는다.
3. **실패는 미실행.** goldfish가 실패하거나 계약에 맞지 않는 출력을 내면 한 번 재시도하고, 다시 실패하면 `not_run`이다. EGM과 같이 "지적 0건"과 구분한다. 계약은 `not_run`인데 지적이 있는 기록을 거부한다.
4. **판정.** skill이 goldfish 결과를 보고 `pass | attention | blocked | incomplete`를 기록한다. 계약은 미실행 검토자나 차단 지적이 있는데 `pass`인 기록만 거부한다. 사람의 반영/보류 선택은 내보내기에 기록될 뿐 판정을 바꾸지 않는다.
5. **검토 뒤 수정 금지.** 가져올 때 앱이 보고서를 다시 렌더링해 `reportHash`와 비교한다. 다르면 `stale_verification`(409)으로 거부한다. 기록을 고쳤다면 goldfish를 다시 실행한다.

## 대안과 기각 이유
- 2라운드 교차 검토로 충분하다고 보기: 교차 검토자는 같은 패킷과 다른 관점의 주장을 이미 봤고, 종합 보고서 자체는 아무도 읽지 않는다.
- 앱 안의 규칙 기반 goldfish(키워드·개수 규칙): 의미를 읽지 못해 오탐과 누락이 많고, 판단을 코드가 대신한다. ADR 0005로 제거했다.
- EGM 플러그인을 그대로 설치해 쓰기: 소프트웨어 설계 문서용 검토자가 중심이다. 패턴과 원칙(맥락 격리, 병렬 검토, not_run 구분, 사람의 결정)만 가져오고 프롬프트는 이 프로젝트에 맞게 새로 썼다.
- goldfish에게 transcript 전체 제공: 맥락을 주는 순간 elephant와 같은 맹점을 공유한다.

## 결과
- `/discussion`에 판정 배너, Goldfish 검증 탭(검토자 상태, 심각도별 지적, 반영/보류), 보고서 Markdown 내보내기.
- 한계: 같은 모델의 goldfish는 같은 편향을 공유할 수 있으므로 지적은 증거로 다루고 자동 거부권으로 쓰지 않는다.
