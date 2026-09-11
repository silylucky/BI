#!/usr/bin/env python3
"""VitalSpan database backup — compose 全量 + 宿主机元库兜底。"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
BACKEND = REPO / "backend"


def _load_backend_env() -> None:
    env_path = BACKEND / ".env"
    if not env_path.is_file():
        return
    import os

    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def _run(cmd: list[str], *, outfile: Path | None = None, cwd: Path | None = None) -> tuple[bool, str]:
    try:
        if outfile:
            with outfile.open("wb") as handle:
                subprocess.run(cmd, check=True, stdout=handle, stderr=subprocess.PIPE, cwd=cwd)
        else:
            subprocess.run(cmd, check=True, capture_output=True, cwd=cwd)
        return True, ""
    except subprocess.CalledProcessError as exc:
        err = (exc.stderr or b"").decode(errors="replace")[:300]
        return False, err


def _compose_cid(service: str) -> str | None:
    proc = subprocess.run(
        ["docker", "compose", "ps", "-q", service],
        cwd=REPO,
        capture_output=True,
        text=True,
    )
    line = proc.stdout.strip().splitlines()
    return line[0] if line else None


def _compose_healthy(service: str) -> bool:
    cid = _compose_cid(service)
    if not cid:
        return False
    proc = subprocess.run(
        ["docker", "inspect", "--format", "{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}", cid],
        capture_output=True,
        text=True,
    )
    status = proc.stdout.strip()
    return status in ("none", "healthy")


def _git_commit() -> str | None:
    try:
        proc = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=REPO,
            capture_output=True,
            text=True,
            check=True,
        )
        return proc.stdout.strip()
    except subprocess.CalledProcessError:
        return None


def _logical_meta_backup(out_dir: Path) -> bool:
    _load_backend_env()
    sys.path.insert(0, str(BACKEND))
    from sqlalchemy import create_engine, text

    from app.core.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()
    engine = create_engine(settings.database_url)
    tables = ["data_sources", "ingestion_sync_jobs", "auth_users", "dashboards", "charts"]
    payload: dict = {}
    with engine.connect() as conn:
        for table in tables:
            try:
                rows = conn.execute(text(f"SELECT * FROM {table}")).mappings().all()
                payload[table] = [dict(r) for r in rows]
            except Exception as exc:
                payload[table] = {"error": str(exc)}
    out = out_dir / "meta-logical-backup.json"

    def _default(obj: object) -> str:
        return str(obj)

    out.write_text(json.dumps(payload, default=_default, indent=2, ensure_ascii=False), encoding="utf-8")
    return True


def main() -> int:
    out_dir = REPO / "data" / "backups" / datetime.now().strftime("%Y%m%d-%H%M%S")
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest: dict = {
        "timestamp": out_dir.name,
        "gitCommit": _git_commit(),
        "files": [],
        "warnings": [],
    }

    def add_file(service: str, path: Path) -> None:
        if path.exists() and path.stat().st_size > 0:
            manifest["files"].append(
                {"service": service, "path": path.name, "bytes": path.stat().st_size}
            )
            print(f"OK {path.name} ({path.stat().st_size} bytes)")

    def warn(msg: str) -> None:
        manifest["warnings"].append(msg)
        print(f"WARN {msg}")

    # --- compose postgres (meta) ---
    if _compose_healthy("postgres"):
        cid = _compose_cid("postgres")
        dest = out_dir / "meta-postgres.dump"
        ok, err = _run(["docker", "exec", cid, "pg_dump", "-U", "vitalspan", "-Fc", "vitalspan"], outfile=dest)
        if ok:
            add_file("postgres", dest)
        else:
            warn(f"postgres dump: {err}")
    else:
        warn("compose postgres not running")

    # --- host meta via docker pg client (5432 非 compose 时) ---
    if not any(f["service"] == "postgres" for f in manifest["files"]):
        dest = out_dir / "meta-postgres-host.dump"
        ok, err = _run(
            [
                "docker",
                "run",
                "--rm",
                "-e",
                "PGPASSWORD=vitalspan",
                "postgres:16-alpine",
                "pg_dump",
                "-h",
                "host.docker.internal",
                "-p",
                "5432",
                "-U",
                "vitalspan",
                "-Fc",
                "vitalspan",
            ],
            outfile=dest,
        )
        if ok:
            add_file("meta-postgres-host", dest)
        else:
            warn(f"host meta pg_dump: {err}")

    # --- logical meta fallback ---
    try:
        logical = out_dir / "meta-logical-backup.json"
        if _logical_meta_backup(out_dir):
            add_file("meta-logical", logical)
    except Exception as exc:
        warn(f"meta logical backup: {exc}")

    # --- analytics postgres ---
    if _compose_healthy("analytics-postgres"):
        cid = _compose_cid("analytics-postgres")
        dest = out_dir / "analytics-postgres.dump"
        ok, err = _run(["docker", "exec", cid, "pg_dump", "-U", "vitalspan", "-Fc", "analytics"], outfile=dest)
        if ok:
            add_file("analytics-postgres", dest)
        else:
            warn(f"analytics-postgres dump: {err}")
    else:
        warn("compose analytics-postgres not running (port 5433)")

    # --- mysql / mariadb ---
    for service, out_name, user, password, db in (
        ("meta-mysql", "meta-mysql.sql", "vitalspan", "vitalspan", "vitalspan"),
        ("sample-mysql", "sample-mysql.sql", "sample", "sample", "sample_db"),
        ("sample-mariadb", "sample-mariadb.sql", "sample", "sample", "sample_db"),
    ):
        if not _compose_healthy(service):
            warn(f"compose {service} not running")
            continue
        cid = _compose_cid(service)
        dest = out_dir / out_name
        ok, err = _run(
            [
                "docker",
                "exec",
                cid,
                "mysqldump",
                f"-u{user}",
                f"-p{password}",
                "--single-transaction",
                db,
            ],
            outfile=dest,
        )
        if ok:
            add_file(service, dest)
        else:
            warn(f"{service} dump: {err}")

    # --- timescaledb ---
    if _compose_healthy("sample-timescaledb"):
        cid = _compose_cid("sample-timescaledb")
        dest = out_dir / "sample-timescaledb.dump"
        ok, err = _run(["docker", "exec", cid, "pg_dump", "-U", "vitalspan", "-Fc", "ops_tsdb"], outfile=dest)
        if ok:
            add_file("sample-timescaledb", dest)
        else:
            warn(f"sample-timescaledb dump: {err}")
    else:
        warn("compose sample-timescaledb not running")

    # --- clickhouse (best effort) ---
    if _compose_healthy("sample-clickhouse"):
        ch_dir = out_dir / "sample-clickhouse"
        ch_dir.mkdir(exist_ok=True)
        cid = _compose_cid("sample-clickhouse")
        proc = subprocess.run(
            ["docker", "exec", cid, "clickhouse-client", "--query", "SHOW TABLES"],
            capture_output=True,
            text=True,
        )
        if proc.returncode == 0:
            for table in proc.stdout.splitlines():
                t = table.strip()
                if not t:
                    continue
                dest = ch_dir / f"{t}.native"
                _run(
                    ["docker", "exec", cid, "clickhouse-client", "--query", f"SELECT * FROM {t} FORMAT Native"],
                    outfile=dest,
                )
            if any(ch_dir.iterdir()):
                add_file("sample-clickhouse", ch_dir)
        else:
            warn("sample-clickhouse table export failed")
    else:
        warn("compose sample-clickhouse not running")

    # --- sqlite ---
    sqlite_src = REPO / "data" / "vitalspan-meta.db"
    if sqlite_src.is_file():
        dest = out_dir / "vitalspan-meta.db"
        shutil.copy2(sqlite_src, dest)
        add_file("sqlite-local", dest)

    (out_dir / "keys-checklist.txt").write_text(
        "\n".join(
            [
                "# Store these secrets separately (no plaintext in backup dir)",
                "JWT_SM2_PRIVATE_KEY",
                "JWT_SM2_PUBLIC_KEY",
                "CREDENTIAL_SM4_KEY",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nBackup dir: {out_dir}")
    if manifest["warnings"]:
        print(f"Warnings: {len(manifest['warnings'])}")
    if not manifest["files"]:
        print("ERROR: no backup files produced", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
