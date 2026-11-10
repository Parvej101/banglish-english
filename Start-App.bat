@echo off
title Banglish Floating Assistant
cd /d "%~dp0"

start "" powershell -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0floating-widget.ps1"
start "" /b node server.js --no-hotkey

echo ========================================================
echo   Floating Button (Banglish -> EN  /  Reply) is ACTIVE!
echo   Look at the top-right side of your screen.
echo ========================================================
