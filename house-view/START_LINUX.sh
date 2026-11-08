#!/bin/sh
# 집 보기 시연판 실행(Linux). Ctrl+C를 누르면 꺼져요.
cd "$(dirname "$0")" || exit 1
if command -v node >/dev/null 2>&1; then
  exec node server.mjs --open
elif command -v python3 >/dev/null 2>&1; then
  exec python3 server.py --open
else
  echo "Node.js 또는 Python 3가 필요해요."
  exit 1
fi
