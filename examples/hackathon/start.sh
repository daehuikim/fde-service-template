#!/usr/bin/env sh
# 명령 하나: 의존성 설치 → DB 초기화 → 시드 → 서버 실행.
# Docker·PostgreSQL 불필요. 설치가 막혀도(오프라인) 로그인·요청·승인 화면은 뜬다.
set -eu
cd "$(dirname "$0")"
PY=${PYTHON:-python3}
if [ ! -d .venv ]; then "$PY" -m venv .venv || true; fi
if [ -x .venv/bin/python ]; then PY=.venv/bin/python; fi
"$PY" -m pip install -q -r requirements.txt || echo "[경고] ortools 설치 실패: 최적화 API만 비활성, 나머지는 동작"
export HK_DB="${HK_DB:-hackathon.db}"
# 로컬 http에서 Safari 등이 Secure 쿠키를 버리면 HK_COOKIE_SECURE=0 으로 실행한다.
exec "$PY" server.py
