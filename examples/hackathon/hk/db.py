"""DB 계층. 기본은 SQLite 파일 하나. 환경 변수 HK_DB 하나로 경로를 바꾼다(":memory:"는 테스트용)."""

import os
import sqlite3

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer','engineer','lead','admin')),
  line TEXT NOT NULL,
  password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
-- 예산 초과를 막는 마지막 방어선: spent <= amount 를 DB가 직접 검사한다.
CREATE TABLE IF NOT EXISTS budgets (
  line TEXT PRIMARY KEY,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  spent INTEGER NOT NULL DEFAULT 0 CHECK (spent >= 0 AND spent <= amount)
);
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY,
  line TEXT NOT NULL,
  title TEXT NOT NULL,
  cost INTEGER NOT NULL CHECK (cost > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved')),
  requested_by INTEGER NOT NULL REFERENCES users(id),
  approved_by INTEGER REFERENCES users(id),
  CHECK (approved_by IS NULL OR approved_by <> requested_by)
);
"""


def connect(path: str | None = None) -> sqlite3.Connection:
    path = path or os.environ.get("HK_DB", "hackathon.db")
    # isolation_level=None: 트랜잭션을 코드에서 BEGIN IMMEDIATE로 직접 연다.
    conn = sqlite3.connect(path, isolation_level=None, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    return conn


SEED_PASSWORD = "hackathon-demo"
SEED_USERS = [
    # email, name, role, line
    ("viewer@example.com", "조회자", "viewer", "L1"),
    ("engineer@example.com", "담당자", "engineer", "L1"),
    ("engineer2@example.com", "다른라인 담당자", "engineer", "L2"),
    ("lead@example.com", "팀장", "lead", "L1"),
    ("admin@example.com", "관리자", "admin", "L1"),
]


def seed(conn: sqlite3.Connection) -> None:
    from .auth import hash_password

    if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]:
        return
    pw = hash_password(SEED_PASSWORD)
    conn.execute("BEGIN")
    conn.executemany(
        "INSERT INTO users(email,name,role,line,password_hash) VALUES (?,?,?,?,?)",
        [(e, n, r, line, pw) for e, n, r, line in SEED_USERS],
    )
    conn.executemany(
        "INSERT INTO budgets(line,amount) VALUES (?,?)", [("L1", 5_000_000), ("L2", 3_000_000)]
    )
    conn.execute("COMMIT")
