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

transcript에는 다음처럼 넣는다. 재시도 후에도 실패한 검토자는 `"status": "not_run", "findings": []`.

```json
"verification": {"reviewers": [
  {"reviewer": "design-critic", "status": "completed", "findings": [ ... ]},
  {"reviewer": "implementation-readiness", "status": "not_run", "findings": []}
]}
```

## transcript 골격

```json
{"version": "1",
 "problem": {"title": "...", "statement": "...", "context": "..."},
 "lenses": ["discovery", "field-debug", "validation"],
 "provider": {"id": "claude-code", "mode": "live"},
 "positions": [], "reviews": [], "failures": []}
```

`pnpm discussion demo cvd-particle`로 완성된 예시(합성)를 볼 수 있다.
