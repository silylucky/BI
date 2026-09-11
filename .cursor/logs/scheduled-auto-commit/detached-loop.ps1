$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$root = Split-Path $root -Parent
Set-Location $root
$log = Join-Path $PSScriptRoot "loop-tick.log"
$pidFile = Join-Path $PSScriptRoot "loop.pid"
Set-Content -Path $pidFile -Value $PID -Encoding utf8
while ($true) {
  Start-Sleep -Seconds 1800
  $ts = Get-Date -Format "yyyy-MM-ddTHH:mm:ssK"
  Add-Content -Path $log -Value "$ts AGENT_LOOP_TICK_SCHEDULED_AUTO_COMMIT"
}
