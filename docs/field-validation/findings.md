# 기준 템플릿 부족분과 반영 항목

기준점: fde-service-template `a146432` → 이 GitHub template으로 만든 내부 검토 기록. 검토 자료는 현재 저장소에 통합했다. 사용자 범위 확정에 따라 제품 코드는 추가하지 않고 분석·방법 선택·설계까지만 평가했다.

| 실제 드러난 부족분 | 사례에서 본 실패 위험 | 기준 레포 반영 |
|---|---|---|
| 실행 예제의 stack이 문제 접근법처럼 보일 수 있음 | 충전소에 Next.js/ontology/optimizer부터 선택하는 편향 | AGENTS/README의 design-first 기본 경로, 예제 stack은 선택 사항임을 명시 |
| brief가 질문 목록이고 방법 선택의 근거 계약은 없음 | 같은 기술의 이름만 바꾼 대안, 필요자료 없는 모델 선택 | design schema: 실질적 메커니즘/필요자료/적합·실패 조건/선택·기각·조건부 이유 |
| 근거 URL과 가정/업체주장/합성 결과가 구분되지 않음 | 공개 위치를 수요로 오인하거나 vendor 성과를 자기 결과로 표시 | source/claim kind, 가정의 영향·확인법·차단 범위, 허위 empirical claim 거부 |
| 정상/오류 테스트는 있으나 '선택을 바꿀 상황' 검토가 없음 | 입력이 바뀌어도 같은 구조를 고집 | requirement→scenario→alternative 연결과 변경 조건 |
| 정량 fixture가 CSV 통과 행 중심 | 좋은 데이터 형식과 좋은 현장 설계를 혼동 | design traceability 보고서, 14개 checker 회귀/변조 테스트, 별도 정성 self review |
| clone 후 새 문제를 어떤 순서로 진행할지 자동 진입점이 약함 | agent가 scaffold 구현부터 시작할 수 있음 | fde-problem-design skill, design:start/check/eval, design playbook |
| 배포 설정은 있으나 현장별 운영 가정이 빠질 수 있음 | 네트워크/자료/승인/owner 미확인 채 기술만 인계 | design pack의 identity/data/capacity/recovery/rollback/관측/운영 책임 |

## 무엇을 검증했다고 말할 수 있나

문서 계약과 연결 검사, 실패 시나리오의 명시, 대안 비교와 기각 이유, 방법 선택 변경 조건은 검토했다. 아직 대표 현장 자료/사람 관찰/독립 전문가 review가 없다. 도구가 설계의 최선 여부나 인용의 진실성을 자동으로 증명하지 않는다. '완전한 자율 산업 문제 해결 assistant'라는 주장은 이 결과로 성립하지 않는다.

다음 실제 현장 1건에서 정책/데이터 소유자와 설계 review를 진행하고, 새로운 문제로 비공개 holdout 평가를 해야 범용성 주장 범위를 늘릴 수 있다.

추가 반영: 7항목 빠른 초안(900자 한도), 용어 정의와 도입/실패 조건, 4개 관점의 비판/잔여 위험. `brief`가 있으면 full design이 미완성이어도 초안을 렌더링한다. 읽기 시간/이해도는 아직 사람에게 측정하지 않았다.
