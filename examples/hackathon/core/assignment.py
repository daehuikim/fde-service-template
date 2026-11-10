"""배정·일정 골격(CP-SAT): 정비 작업을 자격 있는 엔지니어에게, 근무 가능 시간 안에서, 최소 인건비로.

problem = {
  "technicians": [{"id": "T1", "skills": ["CVD"], "capacity": 8, "rate": 50}],
  "tasks": [{"id": "PM-1", "skill": "CVD", "hours": 3}],
}
문제가 바뀌면 변수(x), 제약, 목적함수 세 곳만 고친다. 검사기(checker.py)도 같이 고친다.
"""

from ortools.sat.python import cp_model

from .checker import assignment_cost, check_assignment
from .result import Result, Status, compare, map_status


def _model(problem: dict, pins: dict[str, str] | None, elastic: bool):
    m = cp_model.CpModel()
    techs, tasks = problem["technicians"], problem["tasks"]
    x = {(k["id"], t["id"]): m.new_bool_var(f"x_{k['id']}_{t['id']}") for k in tasks for t in techs}
    unassigned = {k["id"]: m.new_bool_var(f"u_{k['id']}") for k in tasks} if elastic else {}
    overtime = {t["id"]: m.new_int_var(0, 1000, f"o_{t['id']}") for t in techs} if elastic else {}
    for k in tasks:
        # 작업마다 정확히 한 명(완화 모드에서는 "미배정" 허용)
        m.add(
            sum(x[k["id"], t["id"]] for t in techs) + (unassigned[k["id"]] if elastic else 0) == 1
        )
        for t in techs:
            if k["skill"] not in t["skills"]:
                m.add(x[k["id"], t["id"]] == 0)
    for t in techs:
        load = sum(k["hours"] * x[k["id"], t["id"]] for k in tasks)
        m.add(load <= t["capacity"] + (overtime[t["id"]] if elastic else 0))
    for task_id, tech_id in (pins or {}).items():  # 사람이 고정한 배정
        m.add(x[task_id, tech_id] == 1)
    if elastic:
        # 완화 비용을 최소화: 미배정은 크게, 초과근무는 시간당 벌점
        m.minimize(1000 * sum(unassigned.values()) + sum(overtime.values()))
    else:
        m.minimize(sum(k["hours"] * t["rate"] * x[k["id"], t["id"]] for k in tasks for t in techs))
    return m, x, unassigned, overtime


def greedy(problem: dict) -> dict[str, str] | None:
    """현행 방식의 대리 기준선: 작업 순서대로, 자격 있고 시간이 남는 첫 번째 사람에게."""
    left = {t["id"]: t["capacity"] for t in problem["technicians"]}
    out = {}
    for k in problem["tasks"]:
        for t in problem["technicians"]:
            if k["skill"] in t["skills"] and left[t["id"]] >= k["hours"]:
                out[k["id"]] = t["id"]
                left[t["id"]] -= k["hours"]
                break
        else:
            return None
    return out


def solve(problem: dict, time_limit: float = 5.0, pins: dict[str, str] | None = None) -> Result:
    m, x, _, _ = _model(problem, pins, elastic=False)
    s = cp_model.CpSolver()
    s.parameters.max_time_in_seconds = time_limit
    s.parameters.num_workers = 1  # 재현성
    status = map_status(s.solve(m))
    if status is None:  # 시간 안에 해도, 해 없음 증명도 못 함
        return Result(Status.FEASIBLE_TIMEOUT, conflicts=["시간 안에 해를 찾지 못함"])
    if status is Status.INFEASIBLE:
        return explain_infeasible(problem, pins)
    sol = {k: t for (k, t), v in x.items() if s.value(v)}
    violations = check_assignment(problem, sol)
    if violations:  # 솔버 해라도 검사기를 통과하지 못하면 내보내지 않는다
        raise RuntimeError(f"검사기 불통과: {violations}")
    base = greedy(problem)
    base_cost = assignment_cost(problem, base) if base else None
    cost = assignment_cost(problem, sol)
    return Result(
        status,
        solution=sol,
        objective=cost,
        baseline={
            "solution": base,
            "cost": base_cost,
            "violations": check_assignment(problem, base) if base else None,
        },
        comparison=compare(cost, base_cost, len(violations)),
    )


def explain_infeasible(problem: dict, pins: dict[str, str] | None = None) -> Result:
    """탄력 변수(slack)로 다시 풀어, 무엇을 얼마나 완화하면 되는지 최소안을 찾는다."""
    m, _, unassigned, overtime = _model(problem, pins, elastic=True)
    s = cp_model.CpSolver()
    s.parameters.max_time_in_seconds = 5.0
    s.parameters.num_workers = 1
    s.solve(m)
    conflicts, relax = [], []
    tasks = {k["id"]: k for k in problem["tasks"]}
    for k, v in unassigned.items():
        if s.value(v):
            conflicts.append(f"작업 {k}({tasks[k]['skill']})을(를) 맡을 사람이 없음")
            relax.append(f"{tasks[k]['skill']} 자격자 추가 또는 작업 {k} 연기")
    for t, v in overtime.items():
        if s.value(v):
            conflicts.append(f"{t}의 근무 가능 시간 부족")
            relax.append(f"{t} 근무 가능 시간 {s.value(v)}시간 추가")
    if pins:
        conflicts.append("사람이 고정한 배정이 있어 완화안이 그 고정을 전제로 함")
    return Result(Status.INFEASIBLE, conflicts=conflicts, relaxation=relax)


def recheck(
    problem: dict, edited: dict[str, str], pins: dict[str, str], time_limit: float = 5.0
) -> dict:
    """담당자가 결과 일부를 고쳤을 때: 검사기로 재검증하고, 고친 부분을 고정해 재계산한다."""
    violations = check_assignment(problem, edited)
    return {"violations": violations, "recomputed": solve(problem, time_limit, pins=pins).to_json()}
