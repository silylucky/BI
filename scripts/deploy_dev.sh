#!/usr/bin/env bash
# VitalSpan staging deploy — code + data (see docs/material/deploy/2026-08-04-vitalspan-staging-deploy-log.md)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* || "$(uname -s)" == CYGWIN* ]]; then
  exec powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$REPO_ROOT/scripts/deploy_dev.ps1" "$@"
fi

export DEV_HOST="${DEV_HOST:-ontomind@192.168.10.22}"
export VITALSPAN_ROOT="${VITALSPAN_ROOT:-/opt/apps/vitalspan}"
exec "$REPO_ROOT/scripts/deploy_dev.ps1" "$@"
