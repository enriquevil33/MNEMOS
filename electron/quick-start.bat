@echo off
REM MNEMOS Electron Quick Start Script
REM This script helps you get started quickly

echo.
echo ========================================
echo   MNEMOS Electron Quick Start
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js is installed
node --version

echo.
echo Step 1: Building Angular Frontend...
echo.

cd ..\frontend_spa
if not exist "node_modules" (
    echo Installing Angular dependencies...
    call npm install
)

echo Building Angular production build...
call npm run build

if %errorlevel% neq 0 (
    echo [ERROR] Angular build failed!
    pause
    exit /b 1
)

echo [OK] Angular build complete

echo.
echo Step 2: Building Electron Application...
echo.

cd ..\electron
if not exist "node_modules" (
    echo Installing Electron dependencies...
    call npm install
)

echo Building Electron installer...
call node build.js

if %errorlevel% neq 0 (
    echo [ERROR] Electron build failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo Your installer is ready in: electron\dist\
echo.

dir dist\*.exe /b

echo.
echo You can now distribute this installer to end users!
echo.
pause
