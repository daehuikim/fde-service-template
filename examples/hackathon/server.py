"""진입점: DB 초기화 → 시드 → 서버 실행. 의존성 없음(Python 3.10+ 표준 라이브러리만).

python3 server.py            # http://127.0.0.1:8000
HK_DB=/tmp/x.db HK_PORT=9000 python3 server.py
"""

import logging
import os
from http.server import HTTPServer

from hk import db
from hk.web import App, make_handler, secure_cookie_from_env


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    conn = db.connect()
    db.seed(conn)
    app = App(conn, secure_cookie=secure_cookie_from_env())
    host, port = os.environ.get("HK_HOST", "127.0.0.1"), int(os.environ.get("HK_PORT", "8000"))
    # 단일 스레드 서버: sqlite 커넥션 하나로 요청을 하나씩 처리한다(해커톤 데모 규모에 충분).
    # 여러 프로세스가 같은 DB 파일을 쓰더라도 승인은 BEGIN IMMEDIATE 트랜잭션으로 직렬화된다.
    server = HTTPServer((host, port), make_handler(app))
    logging.info(
        "로그인 화면: http://%s:%s  (계정: %s / 비밀번호 %s)",
        host,
        port,
        ", ".join(u[0] for u in db.SEED_USERS),
        db.SEED_PASSWORD,
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
