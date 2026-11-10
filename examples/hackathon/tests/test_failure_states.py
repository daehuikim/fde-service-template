"""실패 상태 7종을 재현한다(references/failure-states.md)."""

import pytest
from hk.solver.result import Result, Status


def test_401_not_logged_in(client):
    assert client().call("GET", "/api/me")[0] == 401


def test_403_forbidden_says_who_can(client):
    status, body = client("viewer").call("PUT", "/api/budgets/L1", {"amount": 1})
    assert status == 403 and "관리자" in body["message"]


def test_422_says_which_field(client):
    status, body = client("engineer").call("POST", "/api/requests", {"title": "", "cost": -5})
    assert status == 422 and set(body["fields"]) == {"title", "cost"}


def test_200_infeasible_is_business_result(client):
    pytest.importorskip("ortools")
    problem = {
        "budget": 1_000_000,
        "required_zones": ["Z1", "Z2"],
        "sites": [{"id": "C1", "cost": 3_000_000, "covers": ["Z1", "Z2"]}],
    }
    status, body = client("engineer").call("POST", "/api/plan/covering", {"problem": problem})
    assert status == 200 and body["status"] == "INFEASIBLE"
    assert body["conflicts"] and any("2,000,000원 증액" in r for r in body["relaxation"])


def test_200_timeout_shows_best_with_flag(client, monkeypatch):
    pytest.importorskip("ortools")
    from hk.solver import covering

    monkeypatch.setattr(
        covering,
        "solve",
        lambda p, time_limit: Result(
            Status.FEASIBLE_TIMEOUT, solution={"sites": ["C1"]}, objective=1
        ),
    )
    status, body = client("engineer").call("POST", "/api/plan/covering", {"problem": {}})
    assert (
        status == 200
        and body["status"] == "FEASIBLE_TIMEOUT"
        and body["optimal_guaranteed"] is False
    )


def test_500_hides_details(client, monkeypatch, caplog):
    from hk import domain

    def boom(*a):
        raise RuntimeError("secret internal detail")

    monkeypatch.setattr(domain, "list_requests", boom)
    status, body = client("engineer").call("GET", "/api/requests")
    assert status == 500 and body["message"] == "잠시 후 다시 시도해 주세요"
    assert "secret" not in str(body) and "secret internal detail" in caplog.text


def test_200_empty(client):
    status, body = client("engineer").call("GET", "/api/requests")
    assert (
        status == 200 and body["items"] == [] and body["empty_message"] == "등록된 항목이 없습니다"
    )


def test_login_page_served(client):
    status, body = client().call("GET", "/")
    assert status == 200 and "로그인" in body.decode()
