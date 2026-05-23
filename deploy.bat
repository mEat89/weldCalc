@echo off
:: Batch file wrapper to run PowerShell deploy script with bypassed execution policy when double-clicked.
cd /d "%~dp0"
title WeldCapacity & Plate Rigidity Check - Deployer
powershell -NoProfile -ExecutionPolicy Bypass -File "deploy.ps1"
if %errorlevel% neq 0 (
    echo.
    echo [PROCESS FAILED] Deployment encountered an error.
)
echo.
echo Press any key to exit...
pause >nul
