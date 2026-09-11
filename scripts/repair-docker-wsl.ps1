# Repair Docker Desktop WSL stuck VHD + engine init failure.
# Run as Administrator: right-click PowerShell -> Run as administrator
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "== VitalSpan Docker WSL repair ==" -ForegroundColor Cyan

$dockerExe = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
$vhdx = Join-Path $env:LOCALAPPDATA 'Docker\wsl\disk\docker_data.vhdx'

Write-Host "[1/6] Quit Docker Desktop..."
if (Test-Path $dockerExe) {
    Start-Process $dockerExe -ArgumentList '-Quit' -Wait -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 3

Write-Host "[2/6] Stop Docker backend processes..."
$names = @('Docker Desktop', 'com.docker.backend', 'com.docker.build', 'wslrelay')
foreach ($name in $names) {
    Get-Process -Name $name -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 3

Write-Host "[3/6] Terminate WSL distros..."
wsl --terminate docker-desktop 2>$null
wsl --terminate docker-desktop-data 2>$null
Start-Sleep -Seconds 2

Write-Host "[4/6] Force shutdown WSL..."
wsl --shutdown --force
Start-Sleep -Seconds 8

Write-Host "[5/6] Detach all mounted WSL disks..."
wsl --unmount 2>$null
if (Test-Path $vhdx) {
    wsl --unmount $vhdx 2>$null
}
Start-Sleep -Seconds 3

Write-Host "[6/6] Start Docker Desktop..."
if (Test-Path $dockerExe) {
    Start-Process $dockerExe
} else {
    throw "Docker Desktop not found at $dockerExe"
}

Write-Host "Waiting for Docker engine (up to 120s)..."
$deadline = (Get-Date).AddSeconds(120)
$ok = $false
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 5
    try {
        $out = docker version 2>&1 | Out-String
        if ($out -match 'Server:' -and $out -notmatch '500 Internal Server Error') {
            $ok = $true
            break
        }
    } catch {
        # keep waiting
    }
    Write-Host '.' -NoNewline
}

Write-Host ''
if ($ok) {
    Write-Host 'Docker engine is healthy.' -ForegroundColor Green
    docker version
    exit 0
}

Write-Host 'Engine still not ready. Open Docker Desktop -> Troubleshoot -> Clean / Purge data, then rerun.' -ForegroundColor Yellow
exit 1
