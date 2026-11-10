@echo off
title Enable Windows Startup for Banglish Assistant
cd /d "%~dp0"

set "TARGET_SCRIPT=%~dp0Start-Background-Silent.vbs"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\Banglish-English-Assistant.lnk"

echo Creating startup shortcut...

powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%TARGET_SCRIPT%\"'; $s.WorkingDirectory = '%~dp0'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo.
    echo ========================================================
    echo  SUCCESS! Banglish Assistant startup shortcut created.
    echo  PC on hobar sathe sathe eta background-e auto cholbe!
    echo ========================================================
) else (
    echo Failed to create shortcut.
)

pause

