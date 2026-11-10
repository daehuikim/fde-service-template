"""라우터 계층. 요청 하나의 경로:
HTTP 요청 → route() → 인증(current_user)·입력 파싱 → domain/solver → JSON + 상태 코드.
Handler는 얇은 어댑터이고, 테스트는 App.handle()을 직접 부른다.
"""

import json
import logging
import os
import re
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler
from pathlib import Path

from . import auth, domain
from .errors import SERVER_ERROR_BODY, AppError, Invalid, NotFound

log = logging.getLogger("hk")
STATIC = Path(__file__).resolve().parent.parent / "web"
COOKIE = "hk_session"


class App:
    def __init__(self, conn, secure_cookie: bool = True):
        self.conn = conn
        self.secure_cookie = secure_cookie

    def handle(self, method: str, path: str, headers: dict, raw: bytes) -> tuple[int, dict, bytes]:
        try:
            status, body, extra = self.route(method, path, headers, raw)
            if isinstance(body, bytes | str):
                return (
                    status,
                    {"content-type": "text/html; charset=utf-8", **extra},
                    body.encode() if isinstance(body, str) else body,
                )
            return (
                status,
                {
                    "content-type": "application/json; charset=utf-8",
                    "cache-control": "no-store",
                    **extra,
                },
                json.dumps(body, ensure_ascii=False).encode(),
            )
        except AppError as e:
            return (
                e.status,
                {"content-type": "application/json; charset=utf-8"},
                json.dumps(e.body(), ensure_ascii=False).encode(),
            )
        except Exception:  # 상세는 서버 로그에만, 화면에는 일반 문구
            log.exception("unhandled error on %s %s", method, path)
            return (
                500,
                {"content-type": "application/json; charset=utf-8"},
                json.dumps(SERVER_ERROR_BODY, ensure_ascii=False).encode(),
            )

    def session_id(self, headers: dict) -> str | None:
        c = SimpleCookie(headers.get("cookie", ""))
        return c[COOKIE].value if COOKIE in c else None

    def cookie(self, sid: str, max_age: int) -> str:
        secure = "; Secure" if self.secure_cookie else ""
        return f"{COOKIE}={sid}; Path=/; HttpOnly; SameSite=Strict; Max-Age={max_age}{secure}"

    def json_body(self, headers: dict, raw: bytes) -> dict:
        if not headers.get("content-type", "").startswith("application/json"):
            raise Invalid({"body": "Content-Type: application/json 이어야 합니다"})
        try:
            body = json.loads(raw or b"{}")
        except json.JSONDecodeError as e:
            raise Invalid({"body": "JSON 형식이 아닙니다"}) from e
        if not isinstance(body, dict):
            raise Invalid({"body": "JSON 객체여야 합니다"})
        return body

    def route(self, method, path, headers, raw):
        c = self.conn
        if method == "GET" and path in ("/", "/index.html"):
            return 200, (STATIC / "index.html").read_bytes(), {}
        if method == "GET" and path == "/api/health":
            return 200, {"ok": True}, {}
        if method == "POST" and path == "/api/login":
            b = self.json_body(headers, raw)
            sid = auth.login(c, str(b.get("email", "")), str(b.get("password", "")))
            return (
                200,
                auth.current_user(c, sid),
                {"set-cookie": self.cookie(sid, auth.SESSION_SECONDS)},
            )
        if method == "POST" and path == "/api/logout":
            auth.logout(c, self.session_id(headers))
            return 200, {"ok": True}, {"set-cookie": self.cookie("", 0)}

        # 이 아래는 전부 로그인 필요(401)
        user = auth.current_user(c, self.session_id(headers))
        if method == "GET" and path == "/api/me":
            return 200, user, {}
        if method == "GET" and path == "/api/requests":
            items = domain.list_requests(c, user)
            return (
                200,
                {"items": items, "empty_message": None if items else "등록된 항목이 없습니다"},
                {},
            )
        if method == "POST" and path == "/api/requests":
            return 201, domain.create_request(c, user, self.json_body(headers, raw)), {}
        if m := re.fullmatch(r"/api/requests/(\d+)", path):
            if method == "GET":
                return 200, domain.get_request(c, user, int(m[1])), {}
        if m := re.fullmatch(r"/api/requests/(\d+)/approve", path):
            if method == "POST":
                return 200, domain.approve_request(c, user, int(m[1])), {}
        if method == "GET" and path == "/api/budgets":
            return 200, {"items": domain.list_budgets(c, user)}, {}
        if m := re.fullmatch(r"/api/budgets/([A-Za-z0-9_-]+)", path):
            if method == "PUT":
                return 200, domain.update_budget(c, user, m[1], self.json_body(headers, raw)), {}
        if m := re.fullmatch(r"/api/plan/(assignment|covering)", path):
            if method == "POST":
                auth.authorize(user, "plan:run")
                return 200, run_plan(m[1], self.json_body(headers, raw)), {}
        raise NotFound("없는 경로입니다")


def run_plan(kind: str, body: dict) -> dict:
    """해 없음·시간 초과도 200: 정상적인 업무 결과다."""
    problem = body.get("problem")
    if not isinstance(problem, dict):
        raise Invalid({"problem": "문제 정의(JSON 객체)가 필요합니다"})
    limit = body.get("time_limit", 5)
    if not isinstance(limit, int | float) or not 0 < limit <= 60:
        raise Invalid({"time_limit": "0초 초과 60초 이하"})
    try:
        if kind == "assignment":
            from core import assignment as mod
        else:
            from core import covering as mod
    except ImportError as e:
        raise AppError(
            "솔버(ortools)가 설치되지 않았습니다. pip install -r requirements.txt"
        ) from e
    try:
        return mod.solve(problem, time_limit=float(limit)).to_json()
    except (KeyError, TypeError) as e:
        raise Invalid({"problem": f"문제 정의 형식이 맞지 않습니다: {e}"}) from e


def make_handler(app: App):
    class Handler(BaseHTTPRequestHandler):
        def _serve(self):
            length = int(self.headers.get("content-length") or 0)
            raw = self.rfile.read(length) if length else b""
            hdrs = {k.lower(): v for k, v in self.headers.items()}
            status, out_headers, body = app.handle(self.command, self.path.split("?")[0], hdrs, raw)
            self.send_response(status)
            for k, v in out_headers.items():
                self.send_header(k, v)
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        do_GET = do_POST = do_PUT = do_DELETE = _serve

        def log_message(self, fmt, *args):
            log.info("%s %s", self.address_string(), fmt % args)

    return Handler


def secure_cookie_from_env() -> bool:
    return os.environ.get("HK_COOKIE_SECURE", "1") != "0"
