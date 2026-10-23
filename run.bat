@echo off
setlocal EnableDelayedExpansion
title Her Comfort Launcher

:: ============================================================================
:: HER COMFORT - FULLSTACK LAUNCHER
:: ============================================================================

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

cls
echo ==============================================================================
echo   HER COMFORT - FULLSTACK LAUNCHER
echo ==============================================================================
echo.
echo   [1] Start FULLSTACK (Backend Server + Mobile/Web App)
echo   [2] Start Mobile/Web App Only (Expo Metro on port 8081)
echo   [3] Start Backend Server Only (Node.js API on port 5000)
echo   [4] Install or Update Dependencies
echo   [5] Exit
echo.
echo ==============================================================================
set /p "choice=Enter your choice [1-5] (Press Enter for 1): "

if "%choice%"=="" set "choice=1"
if "%choice%"=="1" goto DO_FULLSTACK
if "%choice%"=="2" goto DO_FRONTEND
if "%choice%"=="3" goto DO_BACKEND
if "%choice%"=="4" goto DO_DEPS
if "%choice%"=="5" goto DO_EXIT

echo Invalid choice. Exiting.
goto DO_EXIT

:: ----------------------------------------------------------------------------
:: 1. FULLSTACK
:: ----------------------------------------------------------------------------
:DO_FULLSTACK
cls
echo ==============================================================================
echo   STARTING FULLSTACK (Backend + Mobile App)
echo ==============================================================================
echo.

call :CHECK_ENV
if %ERRORLEVEL% NEQ 0 goto DO_EXIT

echo [0/2] Clearing ports 5000 and 8081 if already in use...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8081 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
ping 127.0.0.1 -n 2 >nul


echo [1/2] Launching Backend Server (Port 5000)...
start "Her Comfort - Backend API" cmd /k "cd /d "%SCRIPT_DIR%backend" && npm start"

:: Reliable 3-second sleep without timeout command bugs
ping 127.0.0.1 -n 4 >nul

echo [2/2] Launching Mobile/Web App (Port 8081)...
start "Her Comfort - Mobile App" cmd /k "cd /d "%SCRIPT_DIR%" && npx expo start"

echo.
echo ==============================================================================
echo   SUCCESS! Both services have been started in separate windows:
echo.
echo   - Backend Server:   http://localhost:5000
echo   - Health Check:     http://localhost:5000/health
echo   - Mobile / Web App: http://localhost:8081
echo.
echo   LOGIN CREDENTIALS:
echo   - Email:    test@hercomfort.com
echo   - Password: password123
echo   (Or click "Explore App in Demo Mode" on the login screen)
echo.
echo   To open the Web App in your browser, visit: http://localhost:8081
echo ==============================================================================
echo.
echo You can close this launcher window now.
pause
goto DO_EXIT

:: ----------------------------------------------------------------------------
:: 2. FRONTEND ONLY
:: ----------------------------------------------------------------------------
:DO_FRONTEND
cls
call :CHECK_ENV
if %ERRORLEVEL% NEQ 0 goto DO_EXIT
echo Launching Mobile App on port 8081...
start "Her Comfort - Mobile App" cmd /k "cd /d "%SCRIPT_DIR%" && npx expo start"
pause
goto DO_EXIT

:: ----------------------------------------------------------------------------
:: 3. BACKEND ONLY
:: ----------------------------------------------------------------------------
:DO_BACKEND
cls
call :CHECK_ENV
if %ERRORLEVEL% NEQ 0 goto DO_EXIT
echo Launching Backend Server on port 5000...
echo Clearing port 5000 if already in use...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
ping 127.0.0.1 -n 2 >nul
start "Her Comfort - Backend API" cmd /k "cd /d "%SCRIPT_DIR%backend" && npm start"
pause
goto DO_EXIT

:: ----------------------------------------------------------------------------
:: 4. DEPS
:: ----------------------------------------------------------------------------
:DO_DEPS
cls
echo Installing Mobile App dependencies...
call npm install
echo Installing Backend dependencies...
cd /d "%SCRIPT_DIR%backend"
call npm install
cd /d "%SCRIPT_DIR%"
echo All dependencies installed.
pause
goto DO_EXIT

:: ----------------------------------------------------------------------------
:: HELPERS
:: ----------------------------------------------------------------------------
:CHECK_ENV
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js from https://nodejs.org/ and try again.
    exit /b 1
)
if not exist "%SCRIPT_DIR%node_modules" (
    echo Root node_modules not found. Installing...
    call npm install
)
if not exist "%SCRIPT_DIR%backend\node_modules" (
    echo Backend node_modules not found. Installing...
    cd /d "%SCRIPT_DIR%backend"
    call npm install
    cd /d "%SCRIPT_DIR%"
)
exit /b 0

:DO_EXIT
exit /b 0
