"""L1 truth verify: sync → dataset → execute chain against live API + analytics PG."""
from __future__ import annotations

import json
import os
import sys
import uuid
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_ENV = ROOT / "backend" / ".env"
if BACKEND_ENV.is_file():
    for line in BACKEND_ENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())

API = os.environ.get("TRUTH_VERIFY_API", "http://127.0.0.1:8000")
ADMIN_PASSWORD = os.environ.get("VITALSPAN_DEV_ADMIN_PASSWORD", "changeme")
TRUTH_DATASET_ID = os.environ.get("TRUTH_VERIFY_DATASET_ID", "truth-orders-clean")


def http(method: str, path: str, body: dict | None = None, token: str | None = None) -> tuple[int, dict | list | str]:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(f"{API}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
            try:
                return resp.status, json.loads(raw)
            except json.JSONDecodeError:
                return resp.status, raw
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            return exc.code, json.loads(raw)
        except json.JSONDecodeError:
            return exc.code, raw


def pg_probe() -> dict:
    from sqlalchemy import create_engine, inspect, text

    engine = create_engine("postgresql+psycopg://vitalspan:vitalspan@127.0.0.1:5433/analytics")
    insp = inspect(engine)
    tables = insp.get_table_names()
    out: dict = {"tables": tables, "orders_clean_exists": "orders_clean" in tables}
    if "orders_clean" not in tables:
        return out
    with engine.connect() as conn:
        out["count"] = conn.execute(text("SELECT COUNT(*) FROM orders_clean")).scalar()
        sample = conn.execute(text("SELECT * FROM orders_clean LIMIT 1")).mappings().first()
        out["columns"] = list(sample.keys()) if sample else []
        out["sample_row"] = dict(sample) if sample else None
    return out


def ensure_analytics_datasource(token: str) -> tuple[str | None, dict]:
    code, listed = http("GET", "/api/v1/datasources", token=token)
    if code != 200 or not isinstance(listed, dict):
        return None, {"step": "list_datasources", "code": code, "body": listed}
    items = listed.get("items", [])
    analytics = next(
        (
            d
            for d in items
            if d.get("type") in ("postgresql", "postgres")
            and int(d.get("port", 0)) == 5433
            and d.get("database") == "analytics"
        ),
        None,
    )
    if analytics is None:
        code, created = http(
            "POST",
            "/api/v1/datasources",
            {
                "name": "truth-audit-analytics",
                "code": "truth-audit-analytics",
                "type": "postgresql",
                "host": "127.0.0.1",
                "port": 5433,
                "database": "analytics",
                "username": "vitalspan",
                "password": "vitalspan",
            },
            token=token,
        )
        if code not in (200, 201) or not isinstance(created, dict):
            return None, {"step": "create_datasource", "code": code, "body": created}
        analytics = created
    return analytics["id"], {"step": "analytics_datasource", "id": analytics["id"]}


def verify_dataset_chain(token: str, ds_id: str, pg: dict) -> tuple[bool, dict]:
    dataset_id = TRUTH_DATASET_ID
    table_name = "public.orders_clean"

    code, existing = http("GET", f"/api/v1/datasets/{dataset_id}", token=token)
    if code == 404:
        code, created = http(
            "POST",
            "/api/v1/datasets",
            {
                "datasetId": dataset_id,
                "displayName": "Truth Audit Orders Clean",
                "tables": [{"name": table_name}],
                "computedFields": [],
                "allowedRoles": ["analyst"],
            },
            token=token,
        )
        if code not in (200, 201) or not isinstance(created, dict):
            return False, {"step": "create_dataset", "code": code, "body": created}
    elif code != 200:
        return False, {"step": "get_dataset", "code": code, "body": existing}

    code, cols = http(
        "GET",
        f"/api/v1/datasources/{ds_id}/columns?schema=public&table=orders_clean",
        token=token,
    )
    if code != 200 or not isinstance(cols, dict):
        return False, {"step": "list_columns", "code": code, "body": cols}
    column_names = [c.get("name") for c in cols.get("items", []) if c.get("name")]
    if not column_names:
        return False, {"step": "list_columns", "error": "no columns"}

    code, cfg = http(
        "PUT",
        "/api/v1/query/configs",
        {
            "configType": "dataset_query",
            "schemaVersion": "1.0",
            "refType": "dataset",
            "refId": str(uuid.uuid4()),
            "payload": {
                "dataSourceId": ds_id,
                "connectorType": "postgresql",
                "schema": "public",
                "table": "orders_clean",
                "columns": column_names,
                "conditions": {"logic": "AND", "conditions": []},
                "limit": 1000,
                "offset": 0,
            },
        },
        token=token,
    )
    if code not in (200, 201) or not isinstance(cfg, dict):
        return False, {"step": "create_query_config", "code": code, "body": cfg}
    config_id = cfg.get("id")
    if not config_id:
        return False, {"step": "create_query_config", "error": "missing config id"}

    code, bound = http(
        "POST",
        f"/api/v1/datasets/{dataset_id}/bind-query-config",
        {"configId": config_id},
        token=token,
    )
    if code != 200 or not isinstance(bound, dict):
        return False, {"step": "bind_dataset", "code": code, "body": bound}

    code, body = http(
        "POST",
        "/api/v1/query/dataset/execute",
        {"dataSourceId": ds_id, "configId": config_id},
        token=token,
    )
    if code != 200 or not isinstance(body, dict):
        return False, {"step": "dataset_execute", "code": code, "body": body}

    rows = body.get("rows", [])
    expected = pg.get("count")
    ok_rows = expected is None or len(rows) == expected
    return ok_rows, {
        "step": "dataset_execute",
        "datasetId": dataset_id,
        "configId": config_id,
        "rowCount": len(rows),
        "expectedCount": expected,
        "columns": body.get("columns"),
    }


def main() -> int:
    print("=== PG direct probe ===")
    pg = pg_probe()
    print(json.dumps(pg, ensure_ascii=False, default=str, indent=2))
    if not pg.get("orders_clean_exists"):
        print("FAIL: orders_clean missing")
        return 1

    print("\n=== Login ===")
    code, login = http("POST", "/api/v1/auth/login", {"username": "admin", "password": ADMIN_PASSWORD})
    if code != 200 or not isinstance(login, dict):
        print("FAIL login", code, login)
        return 1
    token = login.get("accessToken") or login.get("access_token")
    if not token:
        print("FAIL login token missing", login)
        return 1
    print("OK login")

    print("\n=== Datasources ===")
    ds_id, ds_meta = ensure_analytics_datasource(token)
    if ds_id is None:
        print("FAIL datasource", ds_meta)
        return 1
    print(json.dumps(ds_meta, ensure_ascii=False, indent=2))

    print("\n=== consume pipeline ===")
    code, jobs = http("GET", "/api/v1/ingestion/sync-jobs", token=token)
    hints_ok = False
    prepare_ok = False
    ensure_ok = False
    consume_meta: dict = {}
    if code == 200 and isinstance(jobs, dict):
        target_job = next(
            (j for j in jobs.get("items", []) if j.get("target_table") == "orders_clean"),
            None,
        )
        if target_job:
            job_id = target_job["id"]
            pcode, prep = http(
                "POST",
                f"/api/v1/ingestion/sync-jobs/{job_id}/prepare-consume",
                token=token,
            )
            prepare_ok = pcode == 200
            print(f"prepare-consume status={pcode}", prep)

            hcode, hints = http(
                "GET",
                f"/api/v1/ingestion/sync-jobs/{job_id}/consume-hints",
                token=token,
            )
            hints_ok = hcode == 200
            print(f"consume-hints status={hcode}", hints)

            ecode, ensured = http(
                "POST",
                f"/api/v1/ingestion/sync-jobs/{job_id}/ensure-dataset",
                token=token,
            )
            ensure_ok = ecode == 200
            print(f"ensure-dataset status={ecode}", ensured)
            consume_meta = {
                "jobId": job_id,
                "prepare_ok": prepare_ok,
                "hints_ok": hints_ok,
                "ensure_ok": ensure_ok,
                "hints": hints if isinstance(hints, dict) else hints,
            }
        else:
            print("skip consume pipeline: no orders_clean sync job")
    else:
        print("skip consume pipeline: list sync jobs failed", code)

    print("\n=== Dataset chain ===")
    dataset_ok, dataset_meta = verify_dataset_chain(token, ds_id, pg)
    print(json.dumps(dataset_meta, ensure_ascii=False, default=str, indent=2))
    if not dataset_ok:
        print("FAIL dataset chain")
        return 1

    code, tables = http("GET", f"/api/v1/datasources/{ds_id}/tables?schema=public", token=token)
    table_names = [t.get("name") for t in tables.get("items", [])] if isinstance(tables, dict) else []

    summary = {
        "pg_count": pg.get("count"),
        "pg_columns": pg.get("columns"),
        "dataset_chain_ok": dataset_ok,
        "consume_hints_ok": hints_ok,
        "consume_prepare_ok": prepare_ok,
        "consume_ensure_ok": ensure_ok,
        "consume_meta": consume_meta,
        "orders_clean_in_schema_browser": "orders_clean" in table_names,
    }
    print("\n=== SUMMARY ===")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if dataset_ok else 1


if __name__ == "__main__":
    sys.path.insert(0, str(ROOT / "backend"))
    raise SystemExit(main())
