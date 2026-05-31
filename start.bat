@echo off

:: --- DOCKER DESKTOP CHECK ---
docker info >nul 2>&1
if %errorlevel% neq 0 (
    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        echo Docker Desktop is installed but not running. Launching it...
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        echo Waiting for Docker to be ready...
        :wait_docker
        timeout /t 5 /nobreak >nul
        docker info >nul 2>&1
        if %errorlevel% neq 0 goto wait_docker
        echo Docker Desktop is now ready.
    ) else (
        cls
        echo =================================================================
        echo   MNEMOS requires Docker Desktop to run.
        echo.
        echo   It looks like Docker Desktop is not installed.
        echo.
        echo   Official download:
        echo   https://docs.docker.com/desktop/setup/install/windows-install/
        echo.
        echo   Opening the URL in your browser...
        echo =================================================================
        start "" "https://docs.docker.com/desktop/setup/install/windows-install/"
        pause
        exit /b 1
    )
)
:: ----------------------------

echo Starting MNEMOS in Default Mode (GPU Enabled)...
echo.

:: --- AUTO CLEANUP ORPHANED IMAGES ---
echo Cleaning up orphaned images...
docker image prune -f >nul 2>&1
:: -------------------------------------

:: --- SMART BUILD LOGIC ---
echo Checking for dependency changes...
powershell -Command "$last = Get-Item .last_build -ErrorAction SilentlyContinue; $files = @('requirements.txt', 'Dockerfile', 'docker-compose.yml', 'frontend_spa\package.json', 'frontend_spa\Dockerfile'); $newest = $files | ForEach-Object { Get-Item $_ -ErrorAction SilentlyContinue } | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if (-not $last -or ($newest.LastWriteTime -gt $last.LastWriteTime)) { exit 1 } else { exit 0 }"

if %errorlevel%==1 (
    echo [SMART BUILD] Changes detected. Rebuilding images...
    set DOCKER_CMD=up --build -d --wait
    type nul > .last_build
) else (
    echo [SMART BUILD] No changes detected. Fast start...
    set DOCKER_CMD=up -d --wait
)
:: -------------------------

:: Check if any .gguf model exists
dir /b models\*.gguf >nul 2>&1
if %errorlevel%==0 (
    echo Model detected. Starting with llamacpp...
    docker-compose -f docker-compose.yml --profile llamacpp %DOCKER_CMD%
) else (
    echo No model found. Starting without llamacpp.
    docker-compose -f docker-compose.yml %DOCKER_CMD%
)

echo Opening browser...
start http://localhost:5200

:: Show logs
docker-compose -f docker-compose.yml logs -f
