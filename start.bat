@echo off
echo Starting MNEMOS in Default Mode (GPU Enabled)...
echo.

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
