# 本地开发依赖一键启动（元库 + 分析库 + 演示 MySQL）
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "Starting VitalSpan dev dependencies..."
docker compose -f "$Root/docker-compose.yml" up -d postgres analytics-postgres sample-mysql

Write-Host "Waiting for postgres health..."
$deadline = (Get-Date).AddMinutes(2)
while ((Get-Date) -lt $deadline) {
    $status = docker inspect --format='{{.State.Health.Status}}' vitalspan-postgres-1 2>$null
    if ($status -eq "healthy") {
        Write-Host "postgres is healthy."
        break
    }
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "  cd backend"
Write-Host "  alembic upgrade head"
Write-Host "  uvicorn app.main:app --host 127.0.0.1 --port 8000"
Write-Host ""
Write-Host "Tip: avoid --reload while debugging sync jobs (background threads may be killed on reload)."
