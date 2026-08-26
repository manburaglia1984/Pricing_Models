@echo off
REM Double-click this to host the pricing model for the team.
REM It serves the index.html sitting next to it and owns data\pricing-store.json.
REM Leave the window open: closing it stops the server and everyone loses the store.

setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed, or not on PATH.
  echo Install the LTS build from https://nodejs.org/ , then double-click this file again.
  echo.
  pause
  exit /b 1
)

echo Starting the shared pricing model store...
echo.
node sync-server.mjs --host 0.0.0.0 --port 8787 %*

echo.
echo The server has stopped.
pause
