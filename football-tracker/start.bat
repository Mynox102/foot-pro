@echo off
title Football Progression Tracker
echo ========================================================
echo    Lancement de l'application Football Progression Tracker
echo ========================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [OK] Node.js detecte dans le PATH.
    node server.js
) else if exist "C:\Users\lucie\AppData\Roaming\Antigravity\bin\agy-node.cmd" (
    echo [OK] Execution via agy-node.cmd...
    call "C:\Users\lucie\AppData\Roaming\Antigravity\bin\agy-node.cmd" server.js
) else (
    echo [ERREUR] Impossible de localiser Node.js.
    pause
)
