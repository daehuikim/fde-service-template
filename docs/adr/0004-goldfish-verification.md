# ADR 0004 · Elephant-Goldfish 검증 라운드

상태: 채택 · 2026-11-09

## 배경
ADR 0003의 토론은 관점 간 anchoring을 줄였지만, 종합 보고서를 쓰는 오케스트레이터는 모든 맥락을 가진 채 자기 결과를 본다. 맥락이 많은 쪽은 보고서에 빠진 전제, 정의 없는 용어, 판별 수단이 없는 쟁점을 "이미 아는 것"으로 넘긴다. Google이 2026년에 공개한 [Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model)(Apache-2.0)은 이 문제를 역할 분리로 다룬다. 맥락을 가진 elephant가 문서를 쓰고, 이전 대화 없이 문서와 참조 자료만 받는 goldfish 검토자들이 병렬로 지적하며, 사람이 무엇을 반영할지 정한다.

## 결정
1. **3라운드 = goldfish 검증.** 종합 뒤 `renderReport`로 보고서를 결정적으로 렌더링하고(해시로 무엇을 검토했는지 고정), goldfish에게는 `{problem, document}`만 넘긴다. transcript·에이전트 대화는 주지 않는다. 이 격리는 테스트로 고정한다.
2. **내장 검토자 3종.** `structural`(구조 검증, 기록에 대한 결정적 규칙: 관점 실패, 2개 미만 탐색, 판별 확인이 없는 쟁점, 근거 없는 관측, 침묵한 관점, 반대 없는 합의), `comprehension`(보고서만으로 결론과 첫 조치를 다시 말할 수 있는가, 정의 없는 약어, 끊긴 참조), `zoom-out`(문제에 나온 조건을 맡을 관점이 빠졌는가). 내장 goldfish는 규칙 기반이라 키 없이 어느 모드에서나 동작한다.
3. **실패는 미실행.** goldfish가 실패하거나 계약에 맞지 않는 출력을 내면 한 번 재시도하고, 다시 실패하면 `not_run`이다. EGM과 같이 "지적 0건"과 구분한다.
4. **판정.** 차단 지적이 있으면 `blocked`, 미실행 검토자가 있으면 `incomplete`, 주요 지적이 있으면 `attention`, 아니면 `pass`. 판정은 검토자의 것이며 사람의 반영/보류 선택은 내보내기에 기록될 뿐 판정을 바꾸지 않는다.
5. **호스트 goldfish.** 실제 LLM goldfish는 호스트가 `fde-multi-agent-review` skill로 새 서브에이전트를 띄워 실행하고, transcript의 `verification.reviewers`로 가져온다. 스키마로 다시 검사하고 내장 검토자 결과와 합친다. 이름이 겹치면 `host-` 접두사를 붙인다.

## 대안과 기각 이유
- 2라운드 교차 검토로 충분하다고 보기: 교차 검토자는 같은 패킷과 다른 관점의 주장을 이미 봤고, 종합 보고서 자체는 아무도 읽지 않는다. 보고서 단계의 빈틈(정의, 참조, 누락된 관점)은 남는다.
- EGM 플러그인을 그대로 설치해 쓰기: 소프트웨어 설계 문서용 검토자와 표준이 중심이고, 앱 안의 결정적 경로와 계약 검사가 필요하다. 패턴과 원칙(맥락 격리, 병렬 검토, not_run 구분, 사람의 결정)만 가져오고 프롬프트·규칙은 이 프로젝트에 맞게 새로 썼다.
- goldfish에게 transcript 전체 제공: 맥락을 주는 순간 elephant와 같은 맹점을 공유한다.

## 결과
- `/discussion`에 판정 배너, Goldfish 검증 탭(검토자 상태, 심각도별 지적, 반영/보류), 보고서 Markdown 내보내기, 진행 레인의 3라운드 표시.
- `pnpm discussion report`, transcript `verification` 필드, `qa/discussion.test.ts` 6건 추가(격리, 재시도·미실행, 구조 규칙, 이해도·관점 이탈 규칙, 호스트 결과 병합).
- 한계: 내장 goldfish는 규칙 기반이라 의미상 오류(잘못된 인과 추론 등)는 잡지 못한다. 그 부분은 호스트 LLM goldfish(`design-critic` 등)가 맡는다. 같은 모델의 goldfish는 같은 편향을 공유할 수 있으므로 지적은 증거로 다루고 자동 거부권으로 쓰지 않는다.
