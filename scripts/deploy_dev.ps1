# VitalSpan staging deploy - code + data
# See docs/material/deploy/2026-08-04-vitalspan-staging-deploy-log.md
param(
    [switch]$SkipBuild,
    [switch]$SkipBackup,
    [switch]$CodeOnly,
    [switch]$DataOnly,
    [switch]$Clean,
    [switch]$Yes
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$DevHost = if ($env:DEV_HOST) { $env:DEV_HOST } else { "ontomind@192.168.10.22" }
$RemoteRoot = if ($env:VITALSPAN_ROOT) { $env:VITALSPAN_ROOT } else { "/opt/apps/vitalspan" }
$RemoteRestoreRoot = if ($env:VITALSPAN_RESTORE_ROOT) { $env:VITALSPAN_RESTORE_ROOT } else { "/opt/apps/vitalspan-restore" }
$StagingUrl = "http://192.168.10.22:8088/admin"

function Write-Step([string]$Msg) { Write-Host ""; Write-Host "==> $Msg" -ForegroundColor Cyan }
function Fail([string]$Msg) { Write-Host "ERROR: $Msg" -ForegroundColor Red; exit 1 }

if ($Clean -and -not $Yes) {
    Fail "Refusing --Clean without -Yes."
}

$mode = "code+data"
if ($DataOnly) { $mode = "data-only" }
elseif ($CodeOnly) { $mode = "code-only" }

Write-Host ""
Write-Host "Deploy preview"
Write-Host "  stack: Python FastAPI + React/Vite (separate dist upload)"
Write-Host "  ssh:   $DevHost"
Write-Host "  root:  $RemoteRoot"
Write-Host "  url:   $StagingUrl"
Write-Host "  mode:  $mode"

if (-not $Yes) {
    $confirm = Read-Host "Continue? [y/N]"
    if ($confirm -notmatch '^[yY]') { Write-Host "Cancelled"; exit 0 }
}

$BackupDir = $null
if (-not $CodeOnly) {
    if (-not $SkipBackup) {
        Write-Step "Local database backup"
        python (Join-Path $PSScriptRoot "backup-databases.py")
        if ($LASTEXITCODE -ne 0) { Fail "backup-databases.py failed" }
    }
    $backupRoot = Join-Path $RepoRoot "data/backups"
    if (Test-Path $backupRoot) {
        $BackupDir = Get-ChildItem $backupRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1
    }
    if (-not $BackupDir) { Fail "no backup directory under data/backups" }
    Write-Host "Backup dir: $($BackupDir.FullName)"
}

if (-not $SkipBuild -and -not $DataOnly) {
    Write-Step "Build frontend (production, same-origin API)"
    $ProdLocal = Join-Path $RepoRoot "fe/.env.production.local"
    if (-not (Test-Path $ProdLocal)) {
        Set-Content -Path $ProdLocal -Value "VITE_API_BASE_URL=" -Encoding UTF8
    }
    Push-Location (Join-Path $RepoRoot "fe")
    pnpm vite build
    if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "pnpm vite build failed" }
    Pop-Location
}

$CodeTar = Join-Path $RepoRoot ".tmp/deploy-code.tar.gz"
if (-not $DataOnly) {
    Write-Step "Pack code (exclude git, node_modules, backups, artifacts)"
    New-Item -ItemType Directory -Force -Path (Join-Path $RepoRoot ".tmp") | Out-Null
    if (Test-Path $CodeTar) { Remove-Item $CodeTar -Force }
    $excludes = @(
        "--exclude=.git", "--exclude=.tmp", "--exclude=.worktrees",
        "--exclude=node_modules", "--exclude=fe/node_modules",
        "--exclude=fe/src", "--exclude=fe/.vite",
        "--exclude=data/backups", "--exclude=data/artifacts",
        "--exclude=backend/data/artifacts", "--exclude=backend/.venv",
        "--exclude=.pytest_cache", "--exclude=.ruff_cache",
        "--exclude=.cursor", "--exclude=.dev/secrets.env",
        "--exclude=.agents", "--exclude=tests"
    )
    & tar -czf $CodeTar @excludes -C $RepoRoot .
    if ($LASTEXITCODE -ne 0) { Fail "tar pack failed" }
    $tarMb = [math]::Round((Get-Item $CodeTar).Length / 1MB, 1)
    Write-Host "Code tarball: $CodeTar ($tarMb MB)"
    if ($tarMb -gt 200) { Fail "tarball too large ($tarMb MB); check excludes" }
}

Write-Step "SSH connectivity"
ssh -o BatchMode=yes -o ConnectTimeout=15 $DevHost "echo ssh_ok"
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "SSH public-key auth failed. Run manually first:" -ForegroundColor Yellow
    Write-Host "  ssh $DevHost"
    Write-Host "Or add your pubkey to remote authorized_keys, then rerun:"
    Write-Host "  .\scripts\deploy_dev.ps1 -Yes"
    Write-Host ""
    if ($BackupDir) { Write-Host "Local backup ready: $($BackupDir.FullName)" }
    if (Test-Path $CodeTar) { Write-Host "Code tarball ready: $CodeTar" }
    exit 1
}

$sudoPass = $env:VITALSPAN_SUDO_PASSWORD
if (-not $sudoPass -and $env:VITALSPAN_STAGING_SSH_PASSWORD) {
    $sudoPass = $env:VITALSPAN_STAGING_SSH_PASSWORD
}
if (-not $sudoPass) {
    Fail "Set VITALSPAN_SUDO_PASSWORD (remote sudo) before deploy"
}
$sudoPassEscaped = $sudoPass.Replace("'", "'\\''")

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$RemoteBackupDir = if ($BackupDir) { "$RemoteRestoreRoot/$($BackupDir.Name)" } else { "$RemoteRestoreRoot/$Stamp" }

if ($BackupDir -and -not $CodeOnly) {
    Write-Step "Upload database backup -> $RemoteBackupDir"
    ssh $DevHost "mkdir -p '$RemoteBackupDir'"
    scp -r "$($BackupDir.FullName)/*" "${DevHost}:${RemoteBackupDir}/"
    if ($LASTEXITCODE -ne 0) { Fail "scp backup failed" }
}

if (-not $DataOnly) {
    Write-Step "Upload code tarball and fe/dist"
    scp $CodeTar "${DevHost}:/tmp/vitalspan-deploy-code.tar.gz"
    if ($LASTEXITCODE -ne 0) { Fail "scp code tar failed" }
    ssh $DevHost "mkdir -p '$RemoteRoot/fe' && echo '$sudoPassEscaped' | sudo -S chown -R ontomind:ontomind '$RemoteRoot/fe'"
    if ($LASTEXITCODE -ne 0) { Fail "remote fe dir chown failed" }
    scp -r (Join-Path $RepoRoot "fe/dist") "${DevHost}:${RemoteRoot}/fe/"
    if ($LASTEXITCODE -ne 0) { Fail "scp fe/dist failed" }
}

Write-Step "Remote restore and service restart"
$remotePath = Join-Path $RepoRoot "deploy/remote_apply.sh"
if (-not (Test-Path $remotePath)) { Fail "missing deploy/remote_apply.sh" }
scp $remotePath "${DevHost}:/tmp/vitalspan_remote_apply.sh"
$dataFlag = if ($DataOnly) { "1" } else { "0" }
$codeFlag = if ($CodeOnly) { "1" } else { "0" }
$cleanFlag = if ($Clean) { "1" } else { "0" }
$remoteCmd = "sed -i 's/\r$//' /tmp/vitalspan_remote_apply.sh && chmod +x /tmp/vitalspan_remote_apply.sh && VITALSPAN_SUDO_PASSWORD='$sudoPassEscaped' VITALSPAN_ROOT='$RemoteRoot' VITALSPAN_BACKUP='$RemoteBackupDir' DATA_ONLY=$dataFlag CODE_ONLY=$codeFlag CLEAN=$cleanFlag bash /tmp/vitalspan_remote_apply.sh"
ssh $DevHost $remoteCmd
if ($LASTEXITCODE -ne 0) { Fail "remote deploy script failed" }

Write-Host ""
Write-Host "Deploy DONE"
Write-Host "  url:  $StagingUrl"
Write-Host "  logs: ssh $DevHost 'sudo journalctl -u vitalspan-backend -f'"
