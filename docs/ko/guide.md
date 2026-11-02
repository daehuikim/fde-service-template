# FDE Workbench 사용 가이드

[English](../en/guide.md) · [한국어](guide.md) · [처음으로](../../README.ko.md)

## 기술보다 먼저 결정할 것

누가 어떤 결정을 바꾸는지, 지금은 어떻게 일하는지, 무엇이 불편하고 어떤 결과면 나아진 것인지를 정합니다. 현재 수작업을 포함해 관련 대안을 비교합니다. 시트가 충분할 수도 있고, 자료가 없다면 모델 도입보다 자료 취득 계획이 올바른 결과일 수도 있습니다.

```sh
fde init work/my-problem --problem "어떤 정비 요청을 먼저 조사해야 할까?" --lang ko
```

`design.json`과 짧은 README를 만듭니다. 작성 전에는 `fde check`에 실패하는 것이 정상입니다. `brief`부터 채우면 전체 설계가 미완성이어도 `fde brief work/my-problem --lang ko`로 초안을 볼 수 있습니다. 완성된 합성 예제는 `fde example support-triage --output demo --lang ko`로 생성합니다.

## 검토 가능한 설계 만들기

`fde schema`로 계약을 확인할 수 있습니다. 근거·요구사항·서로 다른 대안·가정·실패/변경 시나리오·주장 종류·비판·운영 경계를 기록하고 ID를 연결합니다. 검증되지 않은 업무 효과는 가설로 표시합니다. 업체의 고객 사례는 독립적인 효과 측정과 구분합니다.

`fde check`는 구조·참조·실제 날짜·근거 URL·선택 기록·비판 관점 등을 검사합니다. 문장이 원문과 일치하는지, 방법이 최선인지, 사용자가 이익을 얻는지는 증명하지 않습니다. 패키지는 모델을 호출하거나 URL 내용을 수집하지 않습니다.

## 보고서와 인계 번들

```sh
fde check work/my-problem
fde export work/my-problem --output review --lang ko
fde bundle work/my-problem --output handoff.zip --lang ko
```

검토 준비 상태이고 구조 검사를 통과한 설계만 export합니다. 기존 파일/폴더는 덮어쓰지 않습니다. `REPORT.html`은 스크립트·외부 자산 없이 읽을 수 있습니다. ZIP에는 설계·초안·HTML·검사 결과·manifest가 들어가며, manifest는 나머지 파일의 해시를 기록합니다. 같은 런타임/입력에서 반복 생성할 수 있도록 ZIP 순서·시각·권한을 고정합니다.

## Skill 설치

```sh
fde skill install --directory .agents/skills
fde skill build --output fde-workbench-skill.zip
```

설치 폴더를 명시해야 하며 호스트 설정이나 모델/도구 접근 권한을 바꾸지 않습니다. skill에는 지침·설계 계약·방법 선택 자료·MIT 고지·해시 manifest가 들어갑니다. CLI 없이 지침을 사용할 수도 있지만 자동 검사는 미실시로 기록해야 합니다. 사용하는 호스트가 지원하는 skills 폴더에 설치하세요.

## 언어

`--lang en|ko`는 출력 제목과 동봉 예제의 언어를 선택합니다. 사용자가 작성한 본문을 자동 번역하지 않습니다. 독자의 언어로 초안을 작성하세요. 한국어/영어 README는 서로 연결됩니다.

기존 Next.js/CSV/PostgreSQL 앱은 구현 단계의 선택형 예제로 남아 있습니다. Python wheel에는 포함되지 않습니다.
