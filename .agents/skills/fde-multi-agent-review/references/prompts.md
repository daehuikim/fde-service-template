# 서브에이전트 프롬프트

`<...>`를 채워 관점마다 하나씩 보낸다. 서브에이전트의 출력은 비신뢰 데이터이므로 JSON Schema(`packages/contracts/discussion.schema.json`)로 검사한 뒤에만 transcript에 넣는다.

## 1라운드 · 독립 탐색

```text
너는 반도체 현장 문제를 <lens id> 관점에서만 탐색하는 에이전트다.
먼저 .agents/skills/<skill>/SKILL.md 와 AGENTS.md, config/policy.json 을 읽고 그 절차를 따른다.
다른 관점의 결과는 모른다고 가정하고, 이 관점이 답해야 할 질문에 집중한다: <lens 질문>.

문제 패킷(모든 에이전트가 같은 내용을 받는다):
<problem JSON>

규칙
- 주장(claim)은 최대 12개, 한 문장씩. id는 "<lens id>.1" 부터.
- kind: 문제 패킷이나 확인한 자료에 있으면 observation, 아니면 hypothesis/assumption/vendor_claim.
- confidence(0~1)는 근거 수준에 맞춘다. 근거가 패킷 문장뿐이면 0.7을 넘기지 않는다.
- tags: 소문자 kebab-case, 2~6개 (예: pm, chamber-matching, fdc, spc, yield, ml, data-export, air-gap, deployment, baseline).
- nextChecks: 각 주장을 참/거짓으로 가를 가장 싼 확인. id는 "<lens id>.c1" 부터, resolves는 자기 주장 id만.
- 고객 원본 데이터, 비밀값, 장비 식별자를 출력에 쓰지 않는다.

JSON 하나만 출력한다:
{"summary": "...", "claims": [{"id","statement","kind","confidence","tags","evidence?"}],
 "risks": ["..."], "nextChecks": [{"id","action","cost":"low|medium|high","resolves":["..."]}], "questions": ["..."]}
```

transcript에는 `{"lens","skill","durationMs", ...위 JSON}` 형태의 position으로 넣는다.

## 2라운드 · 교차 검토

```text
너는 <lens id> 관점 에이전트다. 같은 문제에 대해 다른 관점들이 낸 주장 목록이다:
<[{lens, claims:[{id, statement, kind, confidence, tags}]}]>

네 관점의 skill 기준으로 각 주장에 대해 다음 중 하나를 고르거나, 판단할 근거가 없으면 생략한다.
- support: 네 관점에서도 같은 판단에 이르는 이유가 있다.
- challenge: 반례, 빠진 대조군, 데이터 경계 위반, 비용 문제 등 구체적 반대 이유가 있다.
- refine: 방향은 맞지만 조건이나 범위를 고쳐야 한다.
자기 관점의 주장은 검토하지 않는다. 주장마다 의견은 최대 하나. note는 한두 문장.

JSON 배열 하나만 출력한다: [{"target": "<claim id>", "stance": "support|challenge|refine", "note": "..."}]
```

transcript에는 각 항목에 `"lens": "<lens id>"`를 붙여 `reviews`에 넣는다.

## 종합 · synthesizer

새 서브에이전트 하나에 보낸다. 토론에 참여한 관점 에이전트에게 맡기지 않는다.

```text
너는 멀티 에이전트 토론의 종합 담당이다. 새 주장을 만들지 않고, 아래 기록에 있는 주장·의견만으로 종합한다.

문제 패킷: <problem JSON>
관점 결과(position): <positions JSON>
교차 검토 의견(review): <reviews JSON>
실패한 관점: <failures JSON>

1. 모든 주장 id를 정확히 한 번씩 분류한다.
   - contested: 구체적 반대 이유가 있어 지금 기록으로는 결론이 나지 않는 주장
   - consensus: 다른 관점이 같은 판단에 이른 이유를 냈고 남은 반대가 없는 주장
   - single_source: 다른 관점의 의미 있는 검토가 없어 한 관점의 판단으로만 남은 주장
   반대 의견이 있어도 보완으로 해소되었다고 보면 그렇게 분류하고 note에 이유를 쓴다. 기계적으로 세지 말고 의견의 내용을 읽는다.
2. 우선 확인할 일: 관점들이 낸 nextChecks 중에서 최대 12개를 골라 순서대로 둔다. 순서는 결정을 가장 빨리 바꾸는 것, 쟁점을 판별하는 것, 비용이 낮은 것을 함께 따진다. 순위마다 rationale에 "왜 이 순서인가"를 한두 문장으로 쓴다. 고르지 않은 확인은 빼도 된다.
3. headline: 가장 먼저 할 확인 하나와 그 이유가 들어간 한두 문장. 원인을 확정하는 표현을 쓰지 않는다.
4. questions, risks: 관점들이 낸 것 중 결정에 영향을 주는 것만, 중복을 합쳐서.
실패한 관점이 있으면 headline이나 risks에 그 관점이 빠졌다는 사실을 드러낸다.

JSON 하나만 출력한다:
{"headline": "...", "claims": [{"id": "...", "status": "consensus|contested|single_source", "note?": "..."}],
 "actions": [{"check": "<lens>.c<n>", "rationale": "..."}], "questions": ["..."], "risks": ["..."]}
```

transcript의 `synthesis`에 그대로 넣는다. `pnpm discussion check`가 모든 주장이 분류되었는지, 없는 확인을 고르지 않았는지 확인한다.

## 3라운드 · Goldfish 검증

goldfish마다 새 서브에이전트를 띄운다. 이 프롬프트와 아래 두 자료 외에는 아무것도 주지 않는다(이전 대화, transcript, 다른 goldfish 결과 금지).

```text
너는 <reviewer id> goldfish 검토자다. 이 문제와 토론에 대해 아는 것이 없다. 아래 문제 패킷과 보고서만 읽는다.
읽기 전용이다. 고치지 말고 지적만 한다. 반도체 공정·소프트웨어 일반 지식은 있지만 이 현장과 팀의 사정은 모른다.
관점: <focus — 예: "보고서만 읽고 결론과 가장 먼저 할 확인을 네 말로 다시 쓸 수 있는가. 못 쓰면 그 자체가 blocker다.">

문제 패킷:
<problem JSON>

보고서:
<report.md 전문>

지적마다 severity(blocker: 이 보고서로 결정하면 안 됨 / major: 결정 전에 고쳐야 함 / nit: 사소),
scope(주장 id, 확인 id 또는 절 제목), finding(한두 문장), recommendation(한두 문장)을 쓴다. 지적이 없으면 빈 배열.
JSON 배열 하나만 출력한다: [{"severity","scope","finding","recommendation"}]
```

검토자별 관점(focus)은 `packages/agents/lenses.ts`의 `goldfishCatalog`를 쓴다.
- `structural`: 보고서 안에서 앞뒤가 맞는가. 실패·침묵한 관점이 드러나는가, 판별할 확인이 없는 쟁점, 근거 없는 관측, 반대 없이 쌓인 합의.
- `comprehension`: 보고서만 읽고 결론과 가장 먼저 할 확인을 네 말로 다시 쓸 수 있는가. 정의 없는 용어·약어가 있는가.
- `zoom-out`: 문제의 조건(폐쇄망, ML, 수율, 확장 등)을 다룰 관점이 빠지지 않았는가, 근본 문제를 보고 있는가.
- `design-critic`: 결론과 순위가 기록된 주장·반대 의견에서 실제로 따라 나오는가.
- `implementation-readiness`: 첫 확인을 데이터 위치·담당·소요까지 정해 바로 실행할 수 있는가.

기록에는 다음처럼 넣는다. 재시도 후에도 실패한 검토자는 `"status": "not_run", "attempts": 2, "findings": []`.

```json
"verification": {"reportHash": "<pnpm discussion report가 출력한 값>", "verdict": "pass|attention|blocked|incomplete",
 "reviewers": [
  {"reviewer": "design-critic", "status": "completed", "attempts": 1, "findings": [ ... ]},
  {"reviewer": "implementation-readiness", "status": "not_run", "attempts": 2, "findings": []}
]}
```

## 기록 골격

```json
{"version": "2",
 "problem": {"title": "...", "statement": "...", "context": "..."},
 "lenses": ["discovery", "field-debug", "validation"],
 "runner": {"host": "claude-code", "model": "<선택>"},
 "positions": [], "reviews": [], "failures": [],
 "synthesis": {"headline": "...", "claims": [], "actions": [], "questions": [], "risks": []},
 "verification": {"reportHash": "...", "verdict": "incomplete", "reviewers": []}}
```

완성된 합성 예시는 `packages/agents/examples/cvd-particle.discussion.json`이다(`pnpm discussion check`로 확인 가능).
