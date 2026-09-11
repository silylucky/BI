param(
  [Parameter(Mandatory = $true)]
  [string]$DeepTalkRoot,
  [string]$IntegrationDir = "integrations\vitalspan"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)))
& (Join-Path $RepoRoot "scripts\sync-vs-ai-spec-to-deeptalk-repo.ps1") -DeepTalkRoot $DeepTalkRoot -IntegrationDir $IntegrationDir
