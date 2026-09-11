#!/usr/bin/env python3
"""将 auth_users 中已知 dev 密码的 bcrypt 哈希升级为 SM3。"""

from __future__ import annotations

import argparse
import os
import sys

_REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_BACKEND = os.path.join(_REPO, "backend")
if _BACKEND not in sys.path:
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
from app.core.crypto.password import hash_password

_BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2y$")


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate dev bcrypt password hashes to SM3")
    parser.add_argument("--dry-run", action="store_true", help="只统计，不写库")
    args = parser.parse_args()

    get_settings.cache_clear()
    _load_backend_env()
    settings = get_settings()

    if settings.vitalspan_env != "development":
        print("refused: VITALSPAN_ENV must be development")
        return 1

    password = settings.vitalspan_dev_admin_password
    sm3_hash = hash_password(password)
    updated = 0
    remaining_bcrypt = 0

    engine = create_engine(settings.database_url)
    with engine.begin() as conn:
        rows = conn.execute(
            text("SELECT id, username, password_hash FROM auth_users")
        ).fetchall()
        for user_id, username, password_hash in rows:
            if not password_hash:
                continue
            if password_hash.startswith("$sm3$"):
                continue
            if any(str(password_hash).startswith(prefix) for prefix in _BCRYPT_PREFIXES):
                remaining_bcrypt += 1
                updated += 1
                if not args.dry_run:
                    conn.execute(
                        text("UPDATE auth_users SET password_hash = :h WHERE id = :id"),
                        {"h": sm3_hash, "id": str(user_id)},
                    )
                print(f"{'[dry-run] ' if args.dry_run else ''}upgrade {username} -> SM3")
            else:
                remaining_bcrypt += 1
                print(f"skip {username}: unknown hash format")

    mode = "dry-run" if args.dry_run else "committed"
    print(f"[{mode}] upgraded={updated} remaining_non_sm3={remaining_bcrypt}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
