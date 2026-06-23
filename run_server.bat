@echo off
title PROBALAJI AI Enterprise Server
echo ========================================================
echo Checking system environment...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not found in system PATH.
    echo Please install Python 3.10+ and select "Add python.exe to PATH".
    pause
    exit /b 1
)

echo [OK] Python detected.
echo ========================================================
echo Starting PROBALAJI AI Enterprise Server on port 8080...
echo Keep this command window open while using the web portal.
echo Press Ctrl+C in this window to stop the server.
echo ========================================================
python server.py
pause
