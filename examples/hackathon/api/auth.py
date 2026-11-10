"""인증(누구인가)과 인가(무엇을 할 수 있나). 검사는 항상 서버에서, 요청마다 한다."""

import hashlib
import hmac
import secrets
import time

from .errors import Forbidden, Unauthorized

SESSION_SECONDS = 8 * 3600


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt, digest = stored.split("$")
    except ValueError:
        return False
    actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=2**14, r=8, p=1)
    return hmac.compare_digest(actual.hex(), digest)


def login(conn, email: str, password: str) -> str:
    """비밀번호 해시를 대조하고 서버 세션을 만든다. 브라우저에는 세션 ID만 준다."""
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not row or not verify_password(password, row["password_hash"]):
        raise Unauthorized("이메일 또는 비밀번호가 맞지 않습니다")
    sid = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO sessions(id,user_id,role,expires_at) VALUES (?,?,?,?)",
        (sid, row["id"], row["role"], int(time.time()) + SESSION_SECONDS),
    )
    return sid


def logout(conn, sid: str | None) -> None:
    if sid:
        conn.execute("DELETE FROM sessions WHERE id = ?", (sid,))


def current_user(conn, sid: str | None) -> dict:
    """401: 누구인지 모를 때."""
    if not sid:
        raise Unauthorized("로그인이 필요합니다")
    row = conn.execute(
        "SELECT u.id,u.email,u.name,u.role,u.line,s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?",
        (sid,),
    ).fetchone()
    if not row or row["expires_at"] < time.time():
        raise Unauthorized("세션이 만료되었습니다")
    return dict(row)


# 2단계(행위): 어떤 역할이 어떤 API를 호출할 수 있는가. 한곳에 모아 둔다.
ACTIONS: dict[str, set[str]] = {
    "request:read": {"viewer", "engineer", "lead", "admin"},
    "request:create": {"engineer"},
    "request:approve": {"lead"},
    "budget:update": {"admin"},
    "plan:run": {"engineer", "lead", "admin"},
}
ROLE_LABEL = {"viewer": "조회자", "engineer": "담당자", "lead": "팀장", "admin": "관리자"}


def authorize(user: dict, action: str, resource: dict | None = None) -> None:
    """403: 누구인지 알지만 허용되지 않을 때. 역할 → 행위 → 데이터 범위 순서로 검사한다."""
    allowed = ACTIONS[action]
    if user["role"] not in allowed:
        who = ", ".join(ROLE_LABEL[r] for r in sorted(allowed))
        raise Forbidden(f"이 작업은 {who}만 할 수 있습니다", allowed_roles=sorted(allowed))
    if resource is None:
        return
    # 3단계(데이터 범위): 관리자를 빼면 자기 라인의 데이터만.
    if user["role"] != "admin" and resource.get("line") != user["line"]:
        raise Forbidden("다른 라인의 데이터에는 접근할 수 없습니다")
    if action == "request:approve" and resource.get("requested_by") == user["id"]:
        raise Forbidden("자기 요청은 승인할 수 없습니다")
