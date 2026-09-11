#Requires -Version 5.1
<#
.SYNOPSIS
  注册 Windows 任务计划：每 30 分钟运行 scripts/scheduled-auto-commit.ps1
.PARAMETER Unregister
  删除已注册任务
.PARAMETER IntervalMinutes
  重复间隔（默认 30）
#>
param(
    [switch]$Unregister,
    [int]$IntervalMinutes = 30
)

$ErrorActionPreference = "Stop"

$TaskName = "VitalSpan-ScheduledAutoCommit"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$Runner = Join-Path $RepoRoot "scripts/scheduled-auto-commit.ps1"

if ($Unregister) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "已删除任务: $TaskName"
    exit 0
}

if (-not (Test-Path $Runner)) {
    throw "找不到脚本: $Runner"
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Runner`"" `
    -WorkingDirectory $RepoRoot

$start = (Get-Date).AddMinutes(1)
$trigger = New-ScheduledTaskTrigger `
    -Once `
    -At $start `
    -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) `
    -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Force | Out-Null

Write-Host "已注册任务: $TaskName"
Write-Host "  脚本: $Runner"
Write-Host "  间隔: 每 $IntervalMinutes 分钟"
Write-Host "  首次: $start"
Write-Host ""
Write-Host "立即试跑:"
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File `"$Runner`""
Write-Host ""
Write-Host "删除任务:"
Write-Host "  powershell -File `"$PSCommandPath`" -Unregister"
