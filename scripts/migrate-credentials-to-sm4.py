#!/usr/bin/env python3
"""将元库中 Fernet 凭证重加密为 SM4（须先备份数据库）。"""

from __future__ import annotations

import argparse
import os
import sys

_REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_BACKEND = os.path.join(_REPO, "backend")
if _REPO not in sys.path:
    sys.path.insert(0, _BACKEND)


def _load_backend_env() -> None:
    env_path = os.path.join(_BACKEND, ".env")
    if not os.path.isfile(env_path):
        return
    with open(env_path, encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, _, value = stripped.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

from sqlalchemy import create_engine, text

from app.core.config import get_settings
from app.core.crypto.credentials import decrypt_credential, encrypt_credential, is_sm4_ciphertext


def _migrate_table(engine, table: str, column: str, *, dry_run: bool) -> int:
    updated = 0
    with engine.begin() as conn:
        rows = conn.execute(text(f"SELECT id, {column} FROM {table}")).fetchall()
        for row_id, cipher in rows:
            if not cipher or is_sm4_ciphertext(cipher):
                continue
            plain = decrypt_credential(cipher)
            new_cipher = encrypt_credential(plain)
            updated += 1
            if not dry_run:
                conn.execute(
                    text(f"UPDATE {table} SET {column} = :c WHERE id = :id"),
                    {"c": new_cipher, "id": row_id},
                )
    return updated


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate Fernet credentials to SM4")
    parser.add_argument("--dry-run", action="store_true", help="只统计，不写库")
    args = parser.parse_args()

    get_settings.cache_clear()
    _load_backend_env()
    settings = get_settings()

    engine = create_engine(settings.database_url)
    ds_count = _migrate_table(engine, "data_sources", "password_encrypted", dry_run=args.dry_run)
    job_count = _migrate_table(
        engine, "ingestion_sync_jobs", "source_password_encrypted", dry_run=args.dry_run
    )
    mode = "dry-run" if args.dry_run else "committed"
    print(f"[{mode}] data_sources.password_encrypted: {ds_count}")
    print(f"[{mode}] ingestion_sync_jobs.source_password_encrypted: {job_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
