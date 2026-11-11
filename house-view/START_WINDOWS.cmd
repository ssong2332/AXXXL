@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 집 보기 시연판을 켜요. 이 창을 닫거나 Ctrl+C를 누르면 꺼져요.
where node >nul 2>nul
if %errorlevel%==0 (
  node server.mjs --open
  goto :end
)
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 server.py --open
  goto :end
)
where python >nul 2>nul
if %errorlevel%==0 (
  python server.py --open
  goto :end
)
echo Node.js 또는 Python 3가 필요해요. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해 주세요.
:end
pause
