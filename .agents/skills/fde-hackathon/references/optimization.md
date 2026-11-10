# 최적화 패턴

코드: `examples/hackathon/core/` (웹·DB를 모르는 순수 파이썬) · 테스트: `tests/test_solver.py` · 설치: `pip install ortools`

## 상태 세 가지 (`core/result.py`)

`OPTIMAL`(최적 증명) · `FEASIBLE_TIMEOUT`(해는 있지만 최적 미보장) · `INFEASIBLE`(해 없음). CP-SAT의 `UNKNOWN`(해도 증명도 없음)은 `FEASIBLE_TIMEOUT` + 빈 해로 보낸다.

## 해 없음이면 이유와 최소 완화안

탄력 변수(slack)를 넣고 "완화량 최소화"로 다시 푼다.
- 배정(`core/assignment.py`): 미배정 허용 + 초과근무 변수 → "LITHO 자격자 추가 또는 PM-4 연기", "T1 근무 2시간 추가"
- 덮개(`core/covering.py`): ① 예산 없이 최소 비용 → "예산 100만 원 증액" ② 예산 지키고 덮는 구역 최대화 → "구역 Z4 포기"

## 검사기는 솔버와 분리 (`core/checker.py`)

검사기는 솔버를 import하지 않는다. 솔버 해, 탐욕 기준선, 사람이 고친 해 모두 저장 전에 같은 검사기를 통과해야 한다. 솔버 해가 검사기에서 떨어지면 내보내지 않고 오류로 올린다(모델 버그 신호).

## 핵심 제약은 세 군데에서

예산 예: ① 솔버 제약 ② 쓰기 직전 서버 검증기(`api/domain.py` `check_budget` → `core/budget.py`) ③ DB CHECK(`spent <= amount`). 동시 승인은 `BEGIN IMMEDIATE` 트랜잭션으로 직렬화.

## 현행 대비

탐욕 해(현행 방식의 대리)를 같이 계산해 "현행 대비 비용 12% 절감, 위반 0건"을 화면에 보인다. 실무자가 알려 준 실제 현행 숫자가 있으면 그것을 우선한다.

## 사람의 수정

`assignment.recheck(problem, edited, pins)`: 고친 해를 검사기로 재검증하고, 고친 칸을 고정(pin)한 채 재계산한다.

## 문제를 바꿀 때 고칠 곳

변수, 제약, 목적함수 세 곳 + 검사기. 계산은 결정론적 코드로, LLM은 해석과 설명 초안에만 쓴다.
