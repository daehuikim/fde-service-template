import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from hk import db  # noqa: E402
from hk.web import App  # noqa: E402


class Client:
    def __init__(self, app: App):
        self.app, self.cookie = app, ""

    def call(self, method, path, body=None, raw=None, ctype="application/json"):
        headers = {"cookie": self.cookie}
        data = b""
        if body is not None or raw is not None:
            headers["content-type"] = ctype
            data = raw if raw is not None else json.dumps(body).encode()
        status, out, payload = self.app.handle(method, path, headers, data)
        if "set-cookie" in out:
            self.cookie = out["set-cookie"].split(";")[0]
        return status, (
            json.loads(payload) if out["content-type"].startswith("application/json") else payload
        )

    def login(self, who: str):
        status, _ = self.call(
            "POST", "/api/login", {"email": f"{who}@example.com", "password": db.SEED_PASSWORD}
        )
        assert status == 200
        return self


@pytest.fixture
def app():
    conn = db.connect(":memory:")
    db.seed(conn)
    return App(conn)


@pytest.fixture
def client(app):
    return lambda who=None: Client(app).login(who) if who else Client(app)
