
@echo off
setlocal
echo ========================================================
echo   MNEMOS Database Restore Tool
echo ========================================================
echo.

set "SQL_FILE=%~1"

:: If no file drag-and-dropped, try to find the latest one in ..\backups
if "%SQL_FILE%"=="" (
    echo No file provided. Searching for latest backup in ..\backups...
    
    for /f "delims=" %%I in ('dir "..\backups\*.sql" /b /o-d /t:w 2^>nul') do (
        set "SQL_FILE=..\backups\%%I"
        goto :FoundFile
    )
    
    echo [ERROR] No .sql files found in ..\backups
    echo USAGE: Drag and drop a .sql file onto this script.
    echo.
    pause
    exit /b
)

:FoundFile
:: Resolve full path
for %%I in ("%SQL_FILE%") do set "FULL_PATH=%%~fI"

echo Target: mnemos_db
echo File:   "%FULL_PATH%"
echo.
echo [WARNING] This will OVERWRITE data in 'mnemos_db'.
echo To avoid conflicts, we recommend WIPING the database first.
echo.
set /p WIPE="Do you want to WIPE the database before importing? (Recommended) (y/n): "

if /i "%WIPE%"=="y" (
    echo.
    echo Wiping database schema...
    docker-compose -f docker-compose.yml exec -T db psql -U mnemos_user -d mnemos_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE EXTENSION IF NOT EXISTS vector; CREATE TYPE file_type_enum AS ENUM ('pdf', 'audio', 'video', 'youtube', 'epub'); CREATE TYPE status_enum AS ENUM ('pending', 'processing', 'completed', 'error');"
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to wipe database.
        pause
        exit /b
    )
    echo Database wiped, vector extension installed, and types created.
)

echo.
echo Importing... (This may take a minute for large files)
echo.

:: Use docker-compose exec with -T to accept input from pipe
type "%FULL_PATH%" | docker-compose -f docker-compose.yml exec -T db psql -U mnemos_user -d mnemos_db

if %errorlevel%==0 (
    echo.
    echo [SUCCESS] Import completed.
) else (
    echo.
    echo [ERROR] Import failed. check if the database container is running.
)

pause
