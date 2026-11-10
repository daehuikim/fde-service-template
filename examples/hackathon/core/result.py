"""솔버 결과 계약: 세 가지 상태를 구분한다."""

from dataclasses import asdict, dataclass, field
from enum import Enum


class Status(str, Enum):
    OPTIMAL = "OPTIMAL"  # 최적해를 증명함
    FEASIBLE_TIMEOUT = "FEASIBLE_TIMEOUT"  # 시간 안에 해는 찾았지만 최적 미보장
    INFEASIBLE = "INFEASIBLE"  # 해 없음: 업무 결과이지 서버 오류가 아니다


@dataclass
class Result:
    status: Status
    solution: dict = field(default_factory=dict)
    objective: int | None = None
    conflicts: list[str] = field(default_factory=list)  # INFEASIBLE일 때 충돌하는 제약
    relaxation: list[str] = field(default_factory=list)  # INFEASIBLE일 때 최소 완화안
    baseline: dict | None = None  # 현행(탐욕) 방식 결과
    comparison: str | None = None  # 화면에 보여줄 "현행 대비" 한 줄

    def to_json(self) -> dict:
        d = asdict(self)
        d["status"] = self.status.value
        d["optimal_guaranteed"] = self.status is Status.OPTIMAL
        return d


def map_status(cp_status) -> Status | None:
    """CP-SAT 상태 → 서비스 상태. 해도 없고 증명도 못 하면 None(시간 초과, 해 없음 미증명)."""
    from ortools.sat.python import cp_model

    if cp_status == cp_model.OPTIMAL:
        return Status.OPTIMAL
    if cp_status == cp_model.FEASIBLE:
        return Status.FEASIBLE_TIMEOUT
    if cp_status == cp_model.INFEASIBLE:
        return Status.INFEASIBLE
    return None


def compare(cost: int, baseline_cost: int | None, violations: int) -> str:
    if baseline_cost is None:
        return f"현행 방식으로는 해를 만들지 못함. 제안안 위반 {violations}건"
    if baseline_cost == 0:
        return f"현행 대비 비용 동일, 위반 {violations}건"
    pct = round((baseline_cost - cost) * 100 / baseline_cost)
    return f"현행 대비 비용 {pct}% 절감, 위반 {violations}건"
