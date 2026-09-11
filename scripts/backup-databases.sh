#!/usr/bin/env bash
# VitalSpan database backup — delegates to Python (compose + host fallback)
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
python scripts/backup-databases.py
