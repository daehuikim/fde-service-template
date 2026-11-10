"""인증·인가 4종: 미로그인 401, 역할 불일치 403, 남의 데이터 403, 자기 요청 승인 403."""


def make_request(client, who="engineer", cost=1_000_000):
    status, body = client(who).call("POST", "/api/requests", {"title": "CVD 챔버 PM", "cost": cost})
    assert status == 201
    return body["id"]


def test_not_logged_in_is_401(client):
    status, body = client().call("GET", "/api/requests")
    assert status == 401 and body["error"] == "unauthorized"


def test_wrong_role_is_403(client):
    status, body = client("viewer").call("POST", "/api/requests", {"title": "x", "cost": 1})
    assert status == 403 and "담당자" in body["message"]
    rid = make_request(client)
    status, body = client("engineer").call("POST", f"/api/requests/{rid}/approve")
    assert status == 403 and body["allowed_roles"] == ["lead"]


def test_other_line_data_is_403(client):
    rid = make_request(client, "engineer2")  # L2 라인 요청
    status, body = client("engineer").call("GET", f"/api/requests/{rid}")  # L1 사용자
    assert status == 403 and "다른 라인" in body["message"]
    status, body = client("engineer").call("GET", "/api/requests")
    assert status == 200 and body["items"] == []  # 목록에서도 안 보인다


def test_self_approval_is_403(app, client):
    lead = client("lead")
    # 팀장이 직접 만든 요청이라고 가정(역할 표상 팀장은 요청 생성 불가이므로 DB에 직접 넣는다)
    lead_id = app.conn.execute("SELECT id FROM users WHERE email='lead@example.com'").fetchone()[0]
    rid = app.conn.execute(
        "INSERT INTO requests(line,title,cost,requested_by) VALUES ('L1','x',1,?)", (lead_id,)
    ).lastrowid
    status, body = lead.call("POST", f"/api/requests/{rid}/approve")
    assert status == 403 and "자기 요청" in body["message"]


def test_session_cookie_is_httponly_secure(app):
    _, headers, _ = app.handle(
        "POST",
        "/api/login",
        {"content-type": "application/json"},
        b'{"email":"lead@example.com","password":"hackathon-demo"}',
    )
    cookie = headers["set-cookie"]
    assert "HttpOnly" in cookie and "Secure" in cookie and "SameSite=Strict" in cookie


def test_budget_triple_defense(app, client):
    """예산 초과: 서버 검증기(409)와 DB CHECK가 모두 막는다."""
    rid = make_request(client, cost=6_000_000)  # L1 예산 5,000,000
    status, body = client("lead").call("POST", f"/api/requests/{rid}/approve")
    assert status == 409 and body["shortfall"] == 1_000_000
    import sqlite3

    import pytest

    with pytest.raises(sqlite3.IntegrityError):
        app.conn.execute("UPDATE budgets SET spent = amount + 1 WHERE line='L1'")
