"""배치·덮개 골격(CP-SAT): 후보지 중 일부를 골라 필수 구역을 모두 덮되 예산 안에서 최소 비용으로.

problem = {
  "budget": 10_000_000,
  "required_zones": ["Z1", "Z2"],
  "sites": [{"id": "C1", "cost": 3_000_000, "covers": ["Z1"]}],
}
예: 감시 카메라·센서·AGV 충전소·예비 부품 창고 배치.
"""

from ortools.sat.python import cp_model

from .checker import check_covering
from .result import Result, Status, compare, map_status


def _solve(problem: dict, *, use_budget: bool, maximize_cover: bool, time_limit: float):
    m = cp_model.CpModel()
    sites = problem["sites"]
    y = {s["id"]: m.new_bool_var(f"y_{s['id']}") for s in sites}
    cost = sum(s["cost"] * y[s["id"]] for s in sites)
    covered = {}
    for z in problem["required_zones"]:
        covering = [y[s["id"]] for s in sites if z in s["covers"]]
        if maximize_cover:
            covered[z] = m.new_bool_var(f"c_{z}")
            m.add(sum(covering) >= covered[z]) if covering else m.add(covered[z] == 0)
        else:
            m.add(sum(covering) >= 1)
    if use_budget:
        m.add(cost <= problem["budget"])
    if maximize_cover:
        # 덮는 구역 수 최대, 같으면 비용 최소
        m.maximize(10**12 * sum(covered.values()) - cost)
    else:
        m.minimize(cost)
    s = cp_model.CpSolver()
    s.parameters.max_time_in_seconds = time_limit
    s.parameters.num_workers = 1
    st = map_status(s.solve(m))
    chosen = sorted(
        k for k, v in y.items() if st in (Status.OPTIMAL, Status.FEASIBLE_TIMEOUT) and s.value(v)
    )
    uncovered = [
        z for z, v in covered.items() if st and st is not Status.INFEASIBLE and not s.value(v)
    ]
    return st, chosen, uncovered


def greedy(problem: dict) -> list[str]:
    """현행 대리 기준선: 아직 안 덮인 구역을 가장 많이 덮는 후보부터."""
    left, chosen = set(problem["required_zones"]), []
    sites = sorted(problem["sites"], key=lambda s: s["cost"])
    while left:
        best = max(sites, key=lambda s: len(left & set(s["covers"])))
        if not left & set(best["covers"]):
            break
        chosen.append(best["id"])
        left -= set(best["covers"])
    return sorted(chosen)


def solve(problem: dict, time_limit: float = 5.0) -> Result:
    status, chosen, _ = _solve(
        problem, use_budget=True, maximize_cover=False, time_limit=time_limit
    )
    if status is None:
        return Result(Status.FEASIBLE_TIMEOUT, conflicts=["시간 안에 해를 찾지 못함"])
    if status is Status.INFEASIBLE:
        return explain_infeasible(problem, time_limit)
    violations = check_covering(problem, chosen)
    if violations:
        raise RuntimeError(f"검사기 불통과: {violations}")
    price = {s["id"]: s["cost"] for s in problem["sites"]}
    cost = sum(price[c] for c in chosen)
    base = greedy(problem)
    base_cost = sum(price[c] for c in base)
    return Result(
        status,
        solution={"sites": chosen},
        objective=cost,
        baseline={"sites": base, "cost": base_cost, "violations": check_covering(problem, base)},
        comparison=compare(cost, base_cost, len(violations)),
    )


def explain_infeasible(problem: dict, time_limit: float = 5.0) -> Result:
    """두 방향의 최소 완화안: (1) 예산을 얼마나 늘려야 하나 (2) 예산을 지키면 어느 구역을 포기하나."""
    conflicts, relax = [], []
    price = {s["id"]: s["cost"] for s in problem["sites"]}
    unreachable = [
        z for z in problem["required_zones"] if not any(z in s["covers"] for s in problem["sites"])
    ]
    if unreachable:
        conflicts.append(f"어떤 후보지도 덮지 못하는 구역: {', '.join(unreachable)}")
        relax.append("해당 구역의 후보지 추가 또는 필수 구역에서 제외")
    else:
        st, chosen, _ = _solve(
            problem, use_budget=False, maximize_cover=False, time_limit=time_limit
        )
        if st in (Status.OPTIMAL, Status.FEASIBLE_TIMEOUT):
            need = sum(price[c] for c in chosen)
            conflicts.append(f"필수 구역 전체 덮기 vs 예산 {problem['budget']:,}원")
            relax.append(
                f"예산 {need - problem['budget']:,}원 증액 (후보 {len(chosen)}곳: {', '.join(chosen)})"
            )
    st, chosen, uncovered = _solve(
        problem, use_budget=True, maximize_cover=True, time_limit=time_limit
    )
    if uncovered and not unreachable:
        relax.append(
            f"예산 유지 시 구역 {', '.join(uncovered)} 포기 (후보 {len(chosen)}곳: {', '.join(chosen)})"
        )
    return Result(Status.INFEASIBLE, conflicts=conflicts, relaxation=relax)
