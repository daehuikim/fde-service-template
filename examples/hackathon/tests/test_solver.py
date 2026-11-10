"""솔버 골격: 세 가지 상태, 독립 검사기, 현행 대비, 사람 수정 후 재검증."""

import pytest
from hk.solver.checker import check_assignment, check_covering

pytest.importorskip("ortools")
from hk.solver import assignment, covering  # noqa: E402
from hk.solver.result import Status  # noqa: E402

TEAM = {
    "technicians": [
        {"id": "T1", "skills": ["CVD", "ETCH"], "capacity": 8, "rate": 70},
        {"id": "T2", "skills": ["CVD"], "capacity": 8, "rate": 40},
    ],
    "tasks": [
        {"id": "PM-1", "skill": "CVD", "hours": 4},
        {"id": "PM-2", "skill": "ETCH", "hours": 4},
        {"id": "PM-3", "skill": "CVD", "hours": 4},
    ],
}


def test_assignment_optimal_beats_greedy():
    r = assignment.solve(TEAM)
    assert r.status is Status.OPTIMAL and check_assignment(TEAM, r.solution) == []
    assert r.objective < r.baseline["cost"] and "절감" in r.comparison


def test_assignment_infeasible_explains():
    p = {**TEAM, "tasks": TEAM["tasks"] + [{"id": "PM-4", "skill": "LITHO", "hours": 1}]}
    r = assignment.solve(p)
    assert r.status is Status.INFEASIBLE and any("PM-4" in c for c in r.conflicts)


def test_manual_edit_rechecked_and_recomputed():
    out = assignment.recheck(TEAM, {"PM-1": "T2", "PM-2": "T2", "PM-3": "T2"}, pins={"PM-1": "T1"})
    assert any("ETCH 자격 없음" in v for v in out["violations"])
    assert out["recomputed"]["solution"]["PM-1"] == "T1"


def test_covering_optimal_and_infeasible():
    p = {
        "budget": 7_000_000,
        "required_zones": ["Z1", "Z2", "Z3", "Z4"],
        "sites": [
            {"id": "C1", "cost": 3_000_000, "covers": ["Z1", "Z2"]},
            {"id": "C2", "cost": 2_500_000, "covers": ["Z2", "Z3"]},
            {"id": "C3", "cost": 2_000_000, "covers": ["Z3", "Z4"]},
            {"id": "C4", "cost": 4_000_000, "covers": ["Z1", "Z4"]},
        ],
    }
    r = covering.solve(p)
    assert r.status is Status.OPTIMAL and r.solution["sites"] == ["C1", "C3"]
    assert check_covering(p, r.solution["sites"]) == []
    r = covering.solve({**p, "budget": 4_000_000})
    assert r.status is Status.INFEASIBLE and any("1,000,000원 증액" in x for x in r.relaxation)


def test_checker_is_independent_of_solver():
    import hk.solver.checker as c

    lines = open(c.__file__, encoding="utf-8").read().splitlines()
    assert not [x for x in lines if x.startswith(("import ", "from "))]
