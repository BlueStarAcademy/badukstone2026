# Firestore -> Railway PostgreSQL one-time migration helper
# Prerequisites:
#   1. server/firebase-service-account.json (Firebase Console -> Service Accounts -> new private key)
#   2. server/.env.local with Railway Postgres PUBLIC URL:
#        DATABASE_URL=postgresql://postgres:...@...proxy.rlwy.net:PORT/railway
#      (Railway dashboard -> Postgres -> Connect -> Public Network)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".\firebase-service-account.json") -and -not (Test-Path "..\firebase-service-account.json")) {
    Write-Host "Missing firebase-service-account.json in server/ or project root" -ForegroundColor Red
    Write-Host "Download from Firebase Console -> Project Settings -> Service Accounts -> Generate new private key"
    exit 1
}

if (-not (Test-Path ".\.env.local")) {
    Write-Host "Missing server/.env.local" -ForegroundColor Red
    Write-Host "Create it with your Railway Postgres public DATABASE_URL, for example:"
    Write-Host "  DATABASE_URL=postgresql://postgres:PASSWORD@HOST:PORT/railway"
    exit 1
}

Write-Host "Running DB schema migration..." -ForegroundColor Cyan
npm run db:migrate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Migrating Firestore data to Railway PostgreSQL..." -ForegroundColor Cyan
npm run migrate:firestore
exit $LASTEXITCODE
