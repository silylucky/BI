# 启动运维时序库并灌入大规模测试数据
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent

Write-Host ">>> 启动 sample-timescaledb ..."
docker compose -f (Join-Path $Root "docker-compose.yml") up -d sample-timescaledb

Write-Host ">>> 等待健康检查 ..."
$deadline = (Get-Date).AddMinutes(3)
do {
    Start-Sleep -Seconds 3
    $health = docker inspect --format='{{.State.Health.Status}}' vitalspan-sample-timescaledb-1 2>$null
    if ($health -eq "healthy") { break }
    if ((Get-Date) -gt $deadline) {
        throw "sample-timescaledb 未在 3 分钟内就绪，请检查 docker compose logs sample-timescaledb"
    }
    Write-Host "  状态: $health ..."
} while ($true)

Write-Host ">>> 灌入时序数据（约 1–3 分钟）..."
Push-Location (Join-Path $Root "backend")
try {
    python ..\scripts\seed-ops-timescaledb.py --truncate @args
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "=== 运维时序库连接参数（VitalSpan 数据源）==="
Write-Host "类型:     TimescaleDB"
Write-Host "主机:     127.0.0.1"
Write-Host "端口:     5434"
Write-Host "数据库:   ops_tsdb"
Write-Host "用户名:   vitalspan"
Write-Host "密码:     vitalspan"
Write-Host ""
Write-Host "功能测试清单: docker/sample-timescaledb/README.md"
