"""세 층 경계: core는 웹·DB를 모른다. api만 core를 부른다."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_core_does_not_import_web_or_db():
    banned = re.compile(r"^\s*(from|import)\s+(api|sqlite3|http|socketserver)\b", re.M)
    for f in (ROOT / "core").glob("*.py"):
        assert not banned.search(f.read_text(encoding="utf-8")), f.name


def test_web_calls_only_api():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    paths = set(re.findall(r'"(/[a-z][^"$`]*)', html))
    assert paths and all(p.startswith("/api/") for p in paths), paths
