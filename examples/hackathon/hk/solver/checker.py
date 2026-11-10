"""솔버와 독립된 제약 검사기. 솔버를 import하지 않는다. 모든 해는 저장 전에 여기를 통과해야 한다.

솔버 버그, 사람의 수동 수정, 탐욕 기준선 모두 같은 검사기로 본다.
"""


def check_assignment(problem: dict, assignment: dict[str, str]) -> list[str]:
    """배정 문제: 모든 작업이 한 명에게, 자격 있는 사람에게, 근무 가능 시간 안에서."""
    techs = {t["id"]: t for t in problem["technicians"]}
    violations = []
    load: dict[str, int] = {}
    for task in problem["tasks"]:
        who = assignment.get(task["id"])
        if who is None:
            violations.append(f"작업 {task['id']}이(가) 배정되지 않음")
            continue
        if who not in techs:
            violations.append(f"작업 {task['id']}: 없는 담당자 {who}")
            continue
        if task["skill"] not in techs[who]["skills"]:
            violations.append(f"작업 {task['id']}: {who}에게 {task['skill']} 자격 없음")
        load[who] = load.get(who, 0) + task["hours"]
    for tid, hours in load.items():
        if tid in techs and hours > techs[tid]["capacity"]:
            violations.append(f"{tid}: {hours}시간 배정, 가능 {techs[tid]['capacity']}시간 초과")
    return violations


def assignment_cost(problem: dict, assignment: dict[str, str]) -> int:
    techs = {t["id"]: t for t in problem["technicians"]}
    return sum(
        task["hours"] * techs[assignment[task["id"]]]["rate"]
        for task in problem["tasks"]
        if task["id"] in assignment
    )


def check_covering(problem: dict, chosen: list[str]) -> list[str]:
    """배치·덮개 문제: 필수 구역을 모두 덮고, 예산을 넘지 않는다."""
    sites = {s["id"]: s for s in problem["sites"]}
    violations = [f"없는 후보지 {c}" for c in chosen if c not in sites]
    covered = {z for c in chosen if c in sites for z in sites[c]["covers"]}
    for zone in problem["required_zones"]:
        if zone not in covered:
            violations.append(f"구역 {zone}이(가) 덮이지 않음")
    cost = sum(sites[c]["cost"] for c in chosen if c in sites)
    if cost > problem["budget"]:
        violations.append(f"예산 {cost - problem['budget']:,}원 초과")
    return violations
