#Requires -Version 5.1
<#
.SYNOPSIS
  Local WIP commit for VitalSpan (no push, no Cursor /loop).
#>
param(
    [switch]$Push,
    [string]$Prefix = "",
    [string]$Scope = ""
)

$ErrorActionPreference = "Stop"

function Get-GitRoot {
    $root = git rev-parse --show-toplevel 2>$null
    if (-not $root) { throw "Not a git repository" }
    return $root.Trim()
}

function Read-JsonFile([string]$Path) {
    if (-not (Test-Path $Path)) { return $null }
    return Get-Content $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Write-JsonFile([string]$Path, $Object) {
    $dir = Split-Path $Path -Parent
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $Object | ConvertTo-Json -Depth 6 | Set-Content -Path $Path -Encoding UTF8
}

function Test-ExcludedPath([string]$Path) {
    $p = $Path -replace '\\', '/'
    if ($p -match '(^|/)data/dashboard-thumbnails/') { return $true }
    if ($p -match '(^|/)\.env(\.|$)|/\.env$') { return $true }
    if ($p -match 'credentials|secret|\.pem$|\.key$') { return $true }
    if ($p -match '(^|/)node_modules/|(^|/)\.venv/|(^|/)__pycache__/') { return $true }
    if ($p -match '(^|/)vendor/geolibre($|/)') { return $true }
    if ($p -match '(^|/)loop\.pid$|(^|/)loop-tick\.log$') { return $true }
    if ($p -match 'scheduled-auto-commit/runs/.*-message\.txt$') { return $true }
    if ($p -match '(^|/)\.dev/secrets\.env$') { return $true }
    return $false
}

function Test-BusinessPath([string]$Path) {
    if (Test-ExcludedPath $Path) { return $false }
    if ($Scope) {
        $scopeNorm = $Scope.TrimEnd('/') + '/'
        $p = ($Path -replace '\\', '/')
        return ($p -like "$scopeNorm*") -or ($p -eq $Scope.TrimEnd('/'))
    }
    return $true
}

$gitRoot = Get-GitRoot
Set-Location $gitRoot

$logDir = Join-Path $gitRoot '.cursor/logs/scheduled-auto-commit'
$runsDir = Join-Path $logDir 'runs'
$statePath = Join-Path $logDir 'state.json'
$genScript = Join-Path $env:USERPROFILE '.cursor/skills/scheduled-auto-commit/scripts/gen-wip-message.ps1'

$startedAt = Get-Date -Format 'yyyy-MM-ddTHH:mm:ssK'
$runId = Get-Date -Format 'yyyy-MM-ddTHHmmss'
$branch = (git branch --show-current 2>$null).Trim()
$trigger = 'task_scheduler'

$runLog = [ordered]@{
    startedAt = $startedAt
    branch    = $branch
    push      = [bool]$Push
    trigger   = $trigger
}

function ConvertTo-StateHashtable($obj) {
    $ht = [ordered]@{}
    if ($null -ne $obj) {
        foreach ($prop in $obj.PSObject.Properties) {
            $ht[$prop.Name] = $prop.Value
        }
    }
    return $ht
}

function Finish-Run([string]$outcome, [hashtable]$extra) {
    $runLog.finishedAt = Get-Date -Format 'yyyy-MM-ddTHH:mm:ssK'
    $runLog.outcome = $outcome
    foreach ($k in $extra.Keys) { $runLog[$k] = $extra[$k] }
    Write-JsonFile (Join-Path $runsDir "$runId.json") $runLog

    $state = ConvertTo-StateHashtable (Read-JsonFile $statePath)
    $state.status = 'idle'
    $state.loopMode = 'task_scheduler'
    $state.loopMonitored = $false
    $state.lastStatus = $outcome
    $state.lastRunAt = $runLog.finishedAt
    if ($extra.ContainsKey('commit')) { $state.lastCommit = $extra.commit }
    if ($extra.ContainsKey('messageSubject')) { $state.lastSubject = $extra.messageSubject }
    if ($state.tickCount) { $state.tickCount = [int]$state.tickCount + 1 } else { $state.tickCount = 1 }
    Write-JsonFile $statePath $state
}

$state = Read-JsonFile $statePath
if ($state -and $state.status -eq 'running' -and $state.lastRunAt) {
    try {
        $lastRun = [datetimeoffset]::Parse($state.lastRunAt)
        if ((Get-Date) - $lastRun.DateTime -lt [TimeSpan]::FromMinutes(15)) {
            Finish-Run 'skipped' @{ reason = 'mutex: previous run still marked running' }
            exit 0
        }
    } catch { }
}

$gitMeta = Join-Path $gitRoot '.git'
if (Test-Path (Join-Path $gitMeta 'MERGE_HEAD')) {
    Finish-Run 'aborted' @{ reason = 'merge in progress' }
    exit 0
}
if (Test-Path (Join-Path $gitMeta 'rebase-merge')) {
    Finish-Run 'aborted' @{ reason = 'rebase in progress' }
    exit 0
}

$protected = @('main', 'master', 'develop')
if ($protected -contains $branch) {
    Finish-Run 'aborted' @{ reason = "protected branch: $branch" }
    exit 0
}

Write-JsonFile $statePath ([ordered]@{
    status        = 'running'
    lastRunAt     = $startedAt
    loopMode      = 'task_scheduler'
    loopMonitored = $false
})

$porcelain = @(git status --porcelain 2>$null | Where-Object { $_.Trim() })
$business = @()
foreach ($line in $porcelain) {
    if ($line -match '^.. (.+)$') {
        $path = $Matches[1].Trim()
        if ($path -match ' -> ') { $path = ($path -split ' -> ')[0].Trim() }
        if (Test-BusinessPath $path) { $business += $path }
    }
}

if ($business.Count -eq 0) {
    Finish-Run 'skipped' @{ reason = 'no business changes after exclusions' }
    exit 0
}

foreach ($p in $business) {
    $ErrorActionPreference = 'Continue'
    git add -- $p 2>&1 | Out-Null
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) {
        Finish-Run 'failed' @{ reason = "git add failed: $p" }
        exit 1
    }
}

if (-not (Test-Path $genScript)) {
    Finish-Run 'failed' @{ reason = "missing gen-wip-message.ps1: $genScript" }
    exit 1
}

$msgPath = Join-Path $runsDir "$runId-message.txt"
$genArgs = @{ OutFile = $msgPath }
if ($Prefix) { $genArgs.Prefix = $Prefix }
& $genScript @genArgs
if ($LASTEXITCODE -ne 0) {
    Finish-Run 'skipped' @{ reason = 'nothing staged after gen-wip-message' }
    exit 0
}

$ErrorActionPreference = 'Continue'
git commit -F $msgPath 2>&1 | Out-Null
$ErrorActionPreference = 'Stop'
if ($LASTEXITCODE -ne 0) {
    Finish-Run 'failed' @{ reason = 'git commit failed (hook or empty)' }
    exit 1
}

$commit = (git rev-parse --short HEAD).Trim()
$subject = (Get-Content $msgPath -TotalCount 1 -Encoding UTF8).Trim()
$shortstat = (git show --stat --oneline -1 2>$null | Select-Object -Last 1)

if ($Push) {
    git push -u origin HEAD
    if ($LASTEXITCODE -ne 0) {
        Finish-Run 'failed' @{ reason = 'git push failed'; commit = $commit; messageSubject = $subject }
        exit 1
    }
}

Finish-Run 'success' @{
    commit             = $commit
    messageSubject     = $subject
    messageBodyPreview = $shortstat
}

exit 0
