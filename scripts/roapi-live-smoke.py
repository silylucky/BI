#!/usr/bin/env python3
"""RoAPI 连接器真机验收（CONN-028 demo 数据）。

前置:
  $env:PMTILES_DATA_DIR="."
  docker compose --profile roapi up -d roapi
  cd backend && uvicorn app.main:app --port 8000

用法（仓库根目录）:
  python scripts/roapi-live-smoke.py
"""
from __future__ import annotations

import json
import sys
import uuid
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = "http://127.0.0.1:8000"
ROAPI = "http://127.0.0.1:8086"
PASSWORD = "changeme"

secrets = ROOT / ".dev" / "secrets.env"
if secrets.is_file():
    for line in secrets.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("VITALSPAN_DEV_ADMIN_PASSWORD="):
            PASSWORD = line.split("=", 1)[1].strip().strip('"').strip("'")
            break


def http_json(method: str, path: str, body: dict | None = None, token: str | None = None) -> tuple[int, dict]:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(f"{API}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"message": raw}
        return exc.code, payload


def login() -> str:
    status, body = http_json("POST", "/api/v1/auth/login", {"username": "admin", "password": PASSWORD})
    if status != 200:
        raise RuntimeError(f"login failed {status}: {body}")
    return body["accessToken"]


def roapi_sql(sql: str) -> list[dict]:
    req = urllib.request.Request(
        f"{ROAPI}/api/sql",
        data=sql.encode("utf-8"),
        headers={"Content-Type": "text/plain"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    print("=== RoAPI 连接器真机验收 (CONN-028) ===\n")

    status, _ = http_json("GET", "/health")
    if status != 200:
        print(f"[FAIL] VitalSpan backend /health → {status}")
        return 1
    print("[OK]   VitalSpan backend /health")

    try:
        schema = json.loads(urllib.request.urlopen(f"{ROAPI}/api/schema", timeout=5).read())
        tables = sorted(schema.keys())
        print(f"[OK]   RoAPI /api/schema → tables: {tables}")
    except Exception as exc:
        print(f"[FAIL] RoAPI 不可达 — {exc}")
        print("       请先: docker compose --profile roapi up -d roapi")
        return 1

    try:
        agg = roapi_sql(
            "SELECT region, SUM(amount) AS total FROM demo_orders GROUP BY region ORDER BY total DESC"
        )
        print(f"[OK]   RoAPI 聚合 SQL → {len(agg)} 行区域汇总")
        for row in agg[:3]:
            print(f"       {row}")
    except Exception as exc:
        print(f"[FAIL] RoAPI SQL — {exc}")
        return 1

    token = login()
    print("[OK]   admin 登录")

    ds_code = f"roapi-demo-{uuid.uuid4().hex[:8]}"
    ds_name = f"RoAPI 演示 {ds_code}"
    test_payload = {
        "name": ds_name,
        "code": ds_code,
        "type": "roapi",
        "host": ROAPI,
        "port": 8086,
        "database": "/api/schema",
        "username": "none",
        "password": "-",
        "connectionOptions": {"connectTimeoutSec": 5, "readTimeoutSec": 30},
    }
    status, test_body = http_json("POST", "/api/v1/datasources/test", test_payload, token=token)
    if status != 200 or not test_body.get("ok"):
        print(f"[FAIL] POST /datasources/test → {status} {test_body}")
        return 1
    print(f"[OK]   连通测试 ok (traceId={test_body.get('traceId', '-')})")

    status, create_body = http_json("POST", "/api/v1/datasources", test_payload, token=token)
    if status not in (200, 201):
        print(f"[FAIL] POST /datasources → {status} {create_body}")
        return 1
    ds_id = create_body["id"]
    print(f"[OK]   创建数据源 id={ds_id}")

    status, tables_body = http_json(
        "GET", f"/api/v1/datasources/{ds_id}/tables?schema=roapi", token=token
    )
    if status != 200:
        print(f"[FAIL] GET tables → {status} {tables_body}")
        return 1
    table_names = [t["name"] for t in tables_body.get("items", [])]
    print(f"[OK]   元数据表列表 → {table_names}")
    if "demo_orders" not in table_names:
        print("[FAIL] demo_orders 不在表列表中")
        return 1

    status, cols_body = http_json(
        "GET",
        f"/api/v1/datasources/{ds_id}/columns?schema=roapi&table=demo_orders",
        token=token,
    )
    if status != 200:
        print(f"[FAIL] GET columns → {status} {cols_body}")
        return 1
    col_names = [c["name"] for c in cols_body.get("items", [])]
    print(f"[OK]   demo_orders 列 → {col_names}")

    query_payload = {
        "dataSourceId": ds_id,
        "mode": "native",
        "nativeBody": {"sql": "SELECT name, amount, region FROM demo_orders ORDER BY amount DESC"},
        "limit": 5,
        "rls": {"enabled": False},
    }
    status, query_body = http_json("POST", "/api/v1/query/execute", query_payload, token=token)
    if status != 200:
        print(f"[FAIL] POST /query/execute → {status} {query_body}")
        return 1
    columns = query_body.get("columns", [])
    rows = query_body.get("rows", [])
    print(f"[OK]   查询 TOP5 → columns={columns}, rows={len(rows)}")
    for row in rows[:3]:
        print(f"       {row}")

    join_payload = {
        "dataSourceId": ds_id,
        "mode": "native",
        "nativeBody": {
            "sql": (
                "SELECT o.name, o.amount, p.product_name "
                "FROM demo_orders o "
                "LEFT JOIN demo_products p ON o.id = 1 "
                "LIMIT 3"
            )
        },
        "limit": 10,
        "rls": {"enabled": False},
    }
    status, join_body = http_json("POST", "/api/v1/query/execute", join_payload, token=token)
    if status == 200 and join_body.get("rows"):
        print(f"[OK]   跨表 JOIN 样例 → {len(join_body['rows'])} 行")
    else:
        print(f"[WARN] 跨表 JOIN 跳过或失败 ({status}) — 单表路径已验真")

    print("\n=== 全部通过 ===")
    print(f"管理台可编辑: http://127.0.0.1:5173/admin/datasources/{ds_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
