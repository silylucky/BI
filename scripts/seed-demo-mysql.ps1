# 向运行中的演示库灌入/刷新测试数据（无需删卷重建）
$ErrorActionPreference = "Stop"
$tablesSql = Join-Path $PSScriptRoot "..\docker\demo-mysql\tables.sql"

function Invoke-DemoSeed {
    param(
        [string]$Container,
        [string]$Database,
        [string]$RootPassword
    )
    Write-Host "Seeding $Database on container $Container ..."
    $remote = "/tmp/vitalspan-demo-tables.sql"
    docker cp $tablesSql "${Container}:${remote}"
    docker exec $Container mysql -uroot "-p$RootPassword" --default-character-set=utf8mb4 $Database -e "source $remote"
    docker exec $Container rm -f $remote
    Write-Host "Done: $Database"
}

Invoke-DemoSeed -Container "vitalspan-sample-mysql" -Database "sample_db" -RootPassword "root"
Invoke-DemoSeed -Container "mysql-practice" -Database "test" -RootPassword "Superset@123456"

Write-Host ""
Write-Host "=== 连接参数 ==="
Write-Host "VitalSpan:  127.0.0.1:3307 / sample_db / sample / sample"
Write-Host "Superset:   127.0.0.1:3306 / test / root / Superset@123456"
Write-Host "DataEase:   host.docker.internal:3306 / test / root / Superset@123456"
