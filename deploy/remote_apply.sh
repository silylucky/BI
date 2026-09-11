#!/usr/bin/env bash
# Runs on staging host during deploy_dev.ps1
set -euo pipefail

if [[ -n "${VITALSPAN_SUDO_PASSWORD:-}" ]]; then
  sudo() { echo "$VITALSPAN_SUDO_PASSWORD" | command sudo -S "$@"; }
fi

REMOTE_ROOT="${VITALSPAN_ROOT:-/opt/apps/vitalspan}"
REMOTE_BACKUP="${VITALSPAN_BACKUP:-}"
DATA_ONLY="${DATA_ONLY:-0}"
CODE_ONLY="${CODE_ONLY:-0}"
CLEAN="${CLEAN:-0}"

if [[ "$DATA_ONLY" != "1" ]]; then
  if [[ "$CLEAN" == "1" ]]; then
    sudo rm -rf "$REMOTE_ROOT"
    sudo mkdir -p "$REMOTE_ROOT"
  fi
  sudo mkdir -p "$REMOTE_ROOT"
  if [[ -f "$REMOTE_ROOT/backend/.env" ]]; then
    cp "$REMOTE_ROOT/backend/.env" /tmp/vitalspan.env.bak
  fi
  sudo tar -xzf /tmp/vitalspan-deploy-code.tar.gz -C "$REMOTE_ROOT"
  if [[ -f /tmp/vitalspan.env.bak ]]; then
    cp /tmp/vitalspan.env.bak "$REMOTE_ROOT/backend/.env"
  fi
  rm -f /tmp/vitalspan-deploy-code.tar.gz
  cd "$REMOTE_ROOT/backend"
  if [[ ! -d .venv ]]; then python3 -m venv .venv; fi
  # shellcheck disable=SC1091
  . .venv/bin/activate
  pip install -q -e ".[connectors-ext,dev]"
  alembic upgrade head
fi

if [[ "$CODE_ONLY" != "1" && -n "$REMOTE_BACKUP" && -d "$REMOTE_BACKUP" ]]; then
  export PGPASSWORD=vitalspan
  meta_dump=""
  for f in meta-postgres.dump meta-postgres-host.dump; do
    if [[ -f "$REMOTE_BACKUP/$f" ]]; then meta_dump="$f"; break; fi
  done
  if [[ -n "$meta_dump" ]]; then
    docker run --rm --network host -e PGPASSWORD -v "$REMOTE_BACKUP:/b" docker.m.daocloud.io/library/postgres:17-alpine \
      pg_restore -h 127.0.0.1 -U vitalspan -d vitalspan --clean --if-exists --no-owner --role=vitalspan "/b/$meta_dump" || true
  fi
  if [[ -f "$REMOTE_BACKUP/analytics-postgres.dump" ]]; then
    docker run --rm --network host -e PGPASSWORD -v "$REMOTE_BACKUP:/b" docker.m.daocloud.io/library/postgres:17-alpine \
      pg_restore -h 127.0.0.1 -U vitalspan -d analytics --clean --if-exists --no-owner --role=vitalspan /b/analytics-postgres.dump || true
  fi
  if [[ -f "$REMOTE_BACKUP/sample-mysql.sql" ]]; then
    sudo bash -c "mysql --defaults-file=/etc/mysql/debian.cnf sample_db < '$REMOTE_BACKUP/sample-mysql.sql'" || true
  fi
fi

if [[ "$DATA_ONLY" != "1" ]]; then
  if [[ -f "$REMOTE_ROOT/deploy/nginx/vitalspan.conf" ]]; then
    sudo cp "$REMOTE_ROOT/deploy/nginx/vitalspan.conf" /etc/nginx/sites-available/vitalspan
    sudo ln -sf /etc/nginx/sites-available/vitalspan /etc/nginx/sites-enabled/vitalspan
  fi
  sudo systemctl restart vitalspan-backend || sudo systemctl start vitalspan-backend
  sudo nginx -t
  sudo systemctl reload nginx
fi

if [[ "$CODE_ONLY" != "1" ]]; then
  curl -fsS http://127.0.0.1:8088/health || true
  echo
fi