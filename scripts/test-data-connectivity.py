#!/usr/bin/env python3
"""Test platform meta DB and saved data source connectivity."""
from __future__ import annotations

import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from sqlalchemy import create_engine, text

from app.core.config import get_settings
from app.core.crypto.credentials import decrypt_credential
from app.datasources.models import DataSource, get_meta_session
from app.datasources.service import test_connection_by_id


def check_url(label: str, url: str | None) -> bool:
    if not url:
        print(f"[SKIP] {label}: URL not configured")
        return False
    try:
        engine = create_engine(url, connect_args={"connect_timeout": 5})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        host_part = url.split("@")[-1] if "@" in url else url
        print(f"[OK]   {label}: {host_part}")
        return True
    except Exception as exc:
        print(f"[FAIL] {label}: {exc}")
        return False


def main() -> int:
    get_settings.cache_clear()
    settings = get_settings()
    print("=== Platform databases ===")
    meta_ok = check_url("meta (DATABASE_URL)", settings.database_url)
    analytics_ok = check_url("analytics (ANALYTICS_DATABASE_URL)", settings.analytics_database_url)

    print("\n=== Saved data sources (SM4 decrypt + test connection) ===")
    session = get_meta_session()
    failed = 0
    try:
        rows = session.query(DataSource).order_by(DataSource.name).all()
        if not rows:
            print("[WARN] No data sources in meta DB")
        for row in rows:
            cipher = row.password_encrypted or ""
            algo = "sm4" if cipher.startswith("sm4:") else "fernet/legacy"
            try:
                decrypt_credential(cipher)
                decrypt_status = "decrypt OK"
            except Exception as exc:
                failed += 1
                print(f"[FAIL] {row.name} ({row.type}) — decrypt FAIL: {exc}")
                continue

            try:
                result = test_connection_by_id(session, row.id, role_codes=["admin"])
            except Exception as exc:
                failed += 1
                print(f"[FAIL] {row.name} ({row.type}) {row.host}:{row.port} — {exc}")
                continue

            tag = "OK" if result.ok else "FAIL"
            if not result.ok:
                failed += 1
            print(
                f"[{tag}] {row.name} ({row.type}) "
                f"{row.host}:{row.port}/{row.database} — {algo}, {decrypt_status}; "
                f"test: {result.message or 'connected'}"
            )
    finally:
        session.close()

    print("\n=== Summary ===")
    if not meta_ok:
        failed += 1
    total = len([x for x in [meta_ok, analytics_ok] if x is not False]) + failed
    if failed:
        print(f"FAILED: {failed} check(s)")
        return 1
    print("All connectivity checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
