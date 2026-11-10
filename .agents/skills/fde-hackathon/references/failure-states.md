# 실패 상태 계약

코드: `api/errors.py`(서버), `web/index.html`의 `api()`(공통 화면 처리). 테스트: `tests/test_failure_states.py`

| 상황 | 코드 | 응답 본문 | 화면 |
|---|---|---|---|
| 로그인 안 됨 | 401 | `{error:"unauthorized"}` | 로그인 화면으로 |
| 권한 없음 | 403 | `message`, `allowed_roles` | 누가 할 수 있는 작업인지 |
| 입력 오류 | 422 | `fields: {칸: 이유}` | 칸 옆에 이유 |
| 해 없음 | 200 | `status:"INFEASIBLE"`, `conflicts`, `relaxation` | 충돌 제약과 완화안 |
| 시간 초과 | 200 | `status:"FEASIBLE_TIMEOUT"`, `optimal_guaranteed:false` | 최선의 해 + "최적 미보장" |
| 서버 오류 | 500 | `"잠시 후 다시 시도해 주세요"`만 | 같은 문구. 상세는 서버 로그에만 |
| 데이터 없음 | 200 | `items:[]`, `empty_message` | "등록된 항목이 없습니다" |

원칙:
- 해 없음은 서버 오류가 아니라 **정상적인 업무 결과**다. 4xx/5xx로 보내지 않는다.
- 예산 초과처럼 상태 충돌로 쓰기가 거절되면 409와 부족액(`shortfall`)을 준다.
- 화면은 모든 응답을 공통 함수 하나로 처리한다. 화면마다 따로 분기하지 않는다.
- 각 상황을 테스트로 재현한다. 시간 초과는 솔버를 대역으로 바꿔 재현한다(실제 시간 제한 테스트는 불안정).
