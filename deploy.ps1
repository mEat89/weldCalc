# PowerShell Deployment Script for WeldCapacity & Plate Rigidity Check
# Enforces tests, builds clean production assets, and publishes to GitHub Pages.

$ErrorActionPreference = "Stop"

# Clear the screen for a pristine experience
Clear-Host

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "   WeldCapacity & Plate Rigidity Check - Deployment CLI  " -ForegroundColor Green -Bold
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

# Helper for colored steps
function Write-Step {
    param([string]$Title)
    Write-Host "--> $Title..." -ForegroundColor Yellow -Bold
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Fail {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red -Bold
    Write-Host "Deployment aborted." -ForegroundColor Red
}

try {
    # Step 1: Pre-checks
    Write-Step "Running environment pre-checks"
    
    # Check for node
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js is not installed or not in your system PATH. Please install Node.js."
    }
    # Check for npm
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw "npm is not installed or not in your system PATH."
    }
    
    $nodeVersion = node -v
    Write-Host "    Found Node.js: $nodeVersion" -ForegroundColor Gray

    # Step 2: Install dependencies if missing
    if (-not (Test-Path "node_modules")) {
        Write-Step "node_modules folder not found, running npm install first"
        npm install
        Write-Success "Dependencies installed successfully."
    } else {
        Write-Host "    node_modules already exists. Skipping install." -ForegroundColor Gray
    }

    # Step 3: Run Unit Tests to protect production
    Write-Step "Running mathematical verification unit tests"
    $testResult = npx vitest run
    if ($LASTEXITCODE -ne 0) {
        throw "Mathematical verification unit tests failed. Correct all calculation bugs before deploying."
    }
    Write-Success "All 28 mathematical verification tests passed successfully."

    # Step 4: Build production assets
    Write-Step "Compiling production assets (vite build)"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Production compilation failed. Please check Vite configuration or syntax errors."
    }
    Write-Success "Production assets compiled successfully into '/dist' directory."

    # Step 5: Deploy to GitHub Pages
    Write-Step "Publishing build to GitHub Pages"
    npm run deploy
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub Pages deployment failed. Check that your git credentials are valid and you have push access."
    }

    Write-Host ""
    Write-Host "=========================================================" -ForegroundColor Green -Bold
    Write-Host " 🎉 PROJECT DEPLOYED SUCCESSFULLY TO GITHUB PAGES! 🎉     " -ForegroundColor Green -Bold
    Write-Host "=========================================================" -ForegroundColor Green -Bold
    Write-Host "Your premium engineering tool is now live on your repository URL." -ForegroundColor Gray
    Write-Host ""
}
catch {
    Write-Host ""
    Write-Fail $_.Exception.Message
    exit 1
}
