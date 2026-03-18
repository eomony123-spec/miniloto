@echo off
cd /d "%~dp0"

powershell -NoProfile -Command ^
  "$portOpen = $false; try { $conn = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 3000 -State Listen -ErrorAction Stop; if ($conn) { $portOpen = $true } } catch {}; if ($portOpen) { Start-Process 'http://127.0.0.1:3000'; Write-Output 'already-running' } else { Write-Output 'start-server' }" > "%temp%\warukun_start_status.txt"

set /p START_STATUS=<"%temp%\warukun_start_status.txt"
del "%temp%\warukun_start_status.txt" >nul 2>&1

if /i "%START_STATUS%"=="already-running" (
  exit /b 0
)

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:3000'"
node server.js
