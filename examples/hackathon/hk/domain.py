"""비즈니스 로직: 작업 요청 생성·조회·승인, 예산 변경. 라우터(web.py)는 이 함수들만 부른다."""

import sqlite3

from .auth import authorize
from .errors import Conflict, Invalid, NotFound


def list_requests(conn, user: dict) -> list[dict]:
    authorize(user, "request:read")
    if user["role"] == "admin":
        rows = conn.execute("SELECT * FROM requests ORDER BY id").fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM requests WHERE line = ? ORDER BY id", (user["line"],)
        ).fetchall()
    return [dict(r) for r in rows]


def get_request(conn, user: dict, request_id: int) -> dict:
    authorize(user, "request:read")
    row = conn.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone()
    if not row:
        raise NotFound("요청이 없습니다")
    authorize(user, "request:read", dict(row))
    return dict(row)


def validate_request(body: dict) -> tuple[str, int]:
    fields = {}
    title = body.get("title")
    cost = body.get("cost")
    if not isinstance(title, str) or not title.strip() or len(title) > 200:
        fields["title"] = "1~200자로 입력해 주세요"
    if not isinstance(cost, int) or isinstance(cost, bool) or cost <= 0:
        fields["cost"] = "0보다 큰 정수(원)로 입력해 주세요"
    if fields:
        raise Invalid(fields)
    return title.strip(), cost


def create_request(conn, user: dict, body: dict) -> dict:
    authorize(user, "request:create")
    title, cost = validate_request(body)
    cur = conn.execute(
        "INSERT INTO requests(line,title,cost,requested_by) VALUES (?,?,?,?)",
        (user["line"], title, cost, user["id"]),
    )
    return get_request(conn, user, cur.lastrowid)


def check_budget(budget: sqlite3.Row, cost: int) -> None:
    """쓰기 직전의 서버 검증기(두 번째 방어선). 첫째는 솔버 제약, 셋째는 DB CHECK."""
    remaining = budget["amount"] - budget["spent"]
    if cost > remaining:
        raise Conflict(
            f"예산이 {cost - remaining:,}원 부족합니다",
            remaining=remaining,
            shortfall=cost - remaining,
        )


def approve_request(conn, user: dict, request_id: int) -> dict:
    # BEGIN IMMEDIATE: 쓰기 잠금을 먼저 잡아 동시 승인이 같은 잔액을 두 번 쓰지 못하게 한다.
    conn.execute("BEGIN IMMEDIATE")
    try:
        row = conn.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone()
        if not row:
            raise NotFound("요청이 없습니다")
        authorize(user, "request:approve", dict(row))
        if row["status"] != "pending":
            raise Conflict("이미 처리된 요청입니다")
        budget = conn.execute("SELECT * FROM budgets WHERE line = ?", (row["line"],)).fetchone()
        check_budget(budget, row["cost"])
        conn.execute(
            "UPDATE budgets SET spent = spent + ? WHERE line = ?", (row["cost"], row["line"])
        )
        conn.execute(
            "UPDATE requests SET status='approved', approved_by=? WHERE id=?",
            (user["id"], request_id),
        )
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    return get_request(conn, user, request_id)


def update_budget(conn, user: dict, line: str, body: dict) -> dict:
    authorize(user, "budget:update", {"line": line})
    amount = body.get("amount")
    if not isinstance(amount, int) or isinstance(amount, bool) or amount < 0:
        raise Invalid({"amount": "0 이상의 정수(원)로 입력해 주세요"})
    try:
        cur = conn.execute("UPDATE budgets SET amount = ? WHERE line = ?", (amount, line))
    except sqlite3.IntegrityError as e:  # DB CHECK(spent <= amount)
        raise Conflict("이미 승인된 금액보다 작게 줄일 수 없습니다") from e
    if cur.rowcount == 0:
        raise NotFound("라인이 없습니다")
    return dict(conn.execute("SELECT * FROM budgets WHERE line = ?", (line,)).fetchone())


def list_budgets(conn, user: dict) -> list[dict]:
    authorize(user, "request:read")
    return [dict(r) for r in conn.execute("SELECT * FROM budgets ORDER BY line")]
