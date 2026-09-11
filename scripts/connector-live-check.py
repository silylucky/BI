#!/usr/bin/env python3
"""30 型连接器真机验收：目录 API + POST /datasources/test 全量探测。

用法（仓库根目录）：
  docker compose -f docker-compose.yml -f docker-compose.connectors.yml --profile connectors up -d
  cd backend && pip install -e ".[connectors-ext]"
  python ../scripts/connector-live-check.py
"""

from __future__ import annotations

import json
import socket
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = "http://127.0.0.1:8000"
PASSWORD = "changeme"

secrets = ROOT / ".dev" / "secrets.env"
if secrets.is_file():
    for line in secrets.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("VITALSPAN_DEV_ADMIN_PASSWORD="):
            PASSWORD = line.split("=", 1)[1].strip().strip('"').strip("'")
            break

FIXTURES = ROOT / "tests" / "fixtures"
M7_SQLITE = FIXTURES / "m7" / "sample.db"
CSV_FIXTURE = FIXTURES / "sample.csv"
XLSX_FIXTURE = FIXTURES / "sample.xlsx"

# 30 型：type → 探测参数（port_check 为 None 表示不做 TCP 探测，如文件路径）
CONNECTOR_TARGETS: list[dict] = [
    # --- 关系型 / MySQL 协议（实库或兼容栈）---
    {"type": "mysql", "name": "真机-MySQL", "host": "127.0.0.1", "port": 3307, "database": "sample_db", "username": "sample", "password": "sample", "port_check": 3307},
    {"type": "mariadb", "name": "真机-MariaDB", "host": "127.0.0.1", "port": 3308, "database": "sample_db", "username": "sample", "password": "sample", "port_check": 3308},
    {"type": "tidb", "name": "真机-TiDB", "host": "127.0.0.1", "port": 3307, "database": "sample_db", "username": "sample", "password": "sample", "port_check": 3307, "note": "MySQL 协议兼容栈"},
    {"type": "oceanbase", "name": "真机-OceanBase", "host": "127.0.0.1", "port": 3307, "database": "sample_db", "username": "sample", "password": "sample", "port_check": 3307, "note": "MySQL 协议兼容栈"},
    {"type": "gbase", "name": "真机-GBase", "host": "127.0.0.1", "port": 3307, "database": "sample_db", "username": "sample", "password": "sample", "port_check": 3307, "note": "MySQL 协议兼容栈"},
    {"type": "doris", "name": "真机-Doris", "host": "127.0.0.1", "port": 3307, "database": "sample_db", "username": "sample", "password": "sample", "port_check": 3307, "note": "MySQL 协议兼容栈"},
    {"type": "starrocks", "name": "真机-StarRocks", "host": "127.0.0.1", "port": 3307, "database": "sample_db", "username": "sample", "password": "sample", "port_check": 3307, "note": "MySQL 协议兼容栈"},
    # --- PostgreSQL 协议 ---
    {"type": "postgresql", "name": "真机-PostgreSQL", "host": "127.0.0.1", "port": 5432, "database": "vitalspan", "username": "vitalspan", "password": "vitalspan", "port_check": 5432},
    {"type": "gaussdb", "name": "真机-GaussDB", "host": "127.0.0.1", "port": 5433, "database": "analytics", "username": "vitalspan", "password": "vitalspan", "port_check": 5433, "note": "PG 协议兼容栈"},
    {"type": "kingbase", "name": "真机-Kingbase", "host": "127.0.0.1", "port": 5432, "database": "vitalspan", "username": "vitalspan", "password": "vitalspan", "port_check": 5432, "note": "PG 协议兼容栈"},
    {"type": "timescaledb", "name": "真机-TimescaleDB", "host": "127.0.0.1", "port": 5434, "database": "ops_tsdb", "username": "vitalspan", "password": "vitalspan", "port_check": 5434},
    {
        "type": "redshift",
        "name": "真机-Redshift",
        "host": "127.0.0.1",
        "port": 5432,
        "database": "vitalspan",
        "username": "vitalspan",
        "password": "vitalspan",
        "port_check": 5432,
        "connection_options": {"sslMode": "disabled"},
        "note": "PG 协议兼容栈",
    },
    # --- 专有实例 ---
    {"type": "oracle", "name": "真机-Oracle", "host": "127.0.0.1", "port": 1521, "database": "XEPDB1", "username": "sample", "password": "sample", "port_check": 1521},
    {"type": "sqlserver", "name": "真机-SQLServer", "host": "127.0.0.1", "port": 1433, "database": "master", "username": "sa", "password": "VitalSpan!Sa2026", "port_check": 1433, "connection_options": {"sslMode": "disabled"}},
    {"type": "clickhouse", "name": "真机-ClickHouse", "host": "127.0.0.1", "port": 8124, "database": "default", "username": "default", "password": "vitalspan", "port_check": 8124},
    {"type": "hive", "name": "真机-Hive", "host": "127.0.0.1", "port": 10000, "database": "default", "username": "hive", "password": "hive", "port_check": 10000},
    {"type": "impala", "name": "真机-Impala", "host": "127.0.0.1", "port": 21050, "database": "default", "username": "impala", "password": "x", "port_check": 21050},
    {"type": "trino", "name": "真机-Trino", "host": "127.0.0.1", "port": 8080, "database": "memory", "username": "trino", "password": "-", "port_check": 8080},
    {"type": "presto", "name": "真机-Presto", "host": "127.0.0.1", "port": 8080, "database": "memory", "username": "trino", "password": "-", "port_check": 8080},
    {"type": "mongodb", "name": "真机-MongoDB", "host": "127.0.0.1", "port": 27017, "database": "admin", "username": "none", "password": "-", "port_check": 27017},
    {"type": "elasticsearch", "name": "真机-Elasticsearch", "host": "127.0.0.1", "port": 9200, "database": "_all", "username": "x", "password": "x", "port_check": 9200},
    {"type": "opensearch", "name": "真机-OpenSearch", "host": "127.0.0.1", "port": 9201, "database": "_all", "username": "x", "password": "x", "port_check": 9201},
    {"type": "influxdb", "name": "真机-InfluxDB", "host": "127.0.0.1", "port": 8086, "database": "metrics", "username": "myorg", "password": "vitalspan-dev-token", "port_check": 8086},
    {"type": "tdengine", "name": "真机-TDengine", "host": "127.0.0.1", "port": 6041, "database": "power", "username": "root", "password": "taosdata", "port_check": 6041},
    {"type": "dm", "name": "真机-DM", "host": "127.0.0.1", "port": 5236, "database": "DAMENG", "username": "SYSDBA", "password": "Dameng_123", "port_check": 5236},
    {"type": "db2", "name": "真机-Db2", "host": "127.0.0.1", "port": 50000, "database": "testdb", "username": "db2inst1", "password": "db2pass", "port_check": 50000},
    # --- 文件 / API / 嵌入式 ---
    {"type": "sqlite", "name": "真机-SQLite", "host": str(M7_SQLITE.resolve()), "port": 1, "database": "main", "username": "sqlite", "password": "x", "port_check": None},
    {"type": "csv", "name": "真机-CSV", "host": str(CSV_FIXTURE.resolve()), "port": 1, "database": "data", "username": "csv", "password": "x", "port_check": None},
    {"type": "excel", "name": "真机-Excel", "host": str(XLSX_FIXTURE.resolve()), "port": 1, "database": "workbook", "username": "excel", "password": "x", "port_check": None},
    {"type": "rest_api", "name": "真机-REST", "host": "127.0.0.1", "port": 8000, "database": "/sample-api/health", "username": "none", "password": "x", "port_check": 8000},
]


def port_open(host: str, port: int, timeout: float = 1.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def http_json(method: str, path: str, body: dict | None = None, token: str | None = None) -> tuple[int, dict]:
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode("utf-8")
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


def build_payload(spec: dict) -> dict:
    payload = {
        "name": spec["name"],
        "code": f"live-check-{spec['type']}",
        "type": spec["type"],
        "host": spec["host"],
        "port": spec["port"],
        "database": spec["database"],
        "username": spec["username"],
        "password": spec["password"],
    }
    if spec.get("connection_options"):
        payload["connectionOptions"] = spec["connection_options"]
    return payload


def main() -> int:
    print("=== VitalSpan 30 型连接器真机验收 ===\n")
    print(f"API: {API}")

    status, health = http_json("GET", "/health")
    if status != 200:
        print(f"health: FAIL {status}")
        return 1
    print(f"health: OK\n")

    try:
        token = login()
        print("login: OK (admin)\n")
    except RuntimeError as exc:
        print(f"login: FAIL — {exc}")
        return 1

    status, types_body = http_json("GET", "/api/v1/datasources/types", token=token)
    if status != 200:
        print(f"types API: FAIL {status}")
        return 1

    catalog_types = {item["type"] for item in types_body.get("items", [])}
    target_types = {spec["type"] for spec in CONNECTOR_TARGETS}
    missing_in_script = sorted(catalog_types - target_types)
    missing_in_catalog = sorted(target_types - catalog_types)
    if missing_in_script:
        print(f"WARN: catalog 有但脚本未覆盖: {missing_in_script}")
    if missing_in_catalog:
        print(f"WARN: 脚本有但 catalog 无: {missing_in_catalog}")

    print(f"目录登记: {len(catalog_types)} 种 | 脚本探测: {len(CONNECTOR_TARGETS)} 种\n")

    connect_results: list[dict] = []
    for spec in CONNECTOR_TARGETS:
        ctype = spec["type"]
        note = spec.get("note", "")
        port_check = spec.get("port_check")

        if port_check is not None:
            if not port_open("127.0.0.1", port_check):
                connect_results.append(
                    {"type": ctype, "status": "skip", "reason": f"port {port_check} closed", "note": note}
                )
                print(f"  SKIP {ctype:14} — 端口 {port_check} 未监听 {note}")
                continue
        elif ctype == "sqlite" and not Path(spec["host"]).is_file():
            connect_results.append({"type": ctype, "status": "skip", "reason": "sqlite fixture missing"})
            print(f"  SKIP {ctype:14} — fixture 缺失")
            continue
        elif ctype in {"csv", "excel"} and not Path(spec["host"]).is_file():
            connect_results.append({"type": ctype, "status": "skip", "reason": "file fixture missing"})
            print(f"  SKIP {ctype:14} — 文件缺失")
            continue

        status, body = http_json("POST", "/api/v1/datasources/test", build_payload(spec), token=token)
        ok = status == 200 and body.get("ok") is True
        connect_results.append(
            {
                "type": ctype,
                "status": "pass" if ok else "fail",
                "http": status,
                "ok": body.get("ok"),
                "code": body.get("code"),
                "message": body.get("message"),
                "latencyMs": body.get("latencyMs"),
                "note": note,
            }
        )
        mark = "PASS" if ok else "FAIL"
        detail = body.get("message") or body.get("code") or body
        suffix = f" ({note})" if note else ""
        print(f"  {mark:4} {ctype:14} — {detail}{suffix}")

    passes = [r for r in connect_results if r["status"] == "pass"]
    skips = [r for r in connect_results if r["status"] == "skip"]
    fails = [r for r in connect_results if r["status"] == "fail"]

    out = ROOT / ".tmp" / "connector_live_check.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(
            {
                "health": health,
                "catalogTotal": len(catalog_types),
                "targetTotal": len(CONNECTOR_TARGETS),
                "connectResults": connect_results,
                "summary": {"pass": len(passes), "skip": len(skips), "fail": len(fails)},
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\n结果: PASS {len(passes)} | SKIP {len(skips)} | FAIL {len(fails)}")
    print(f"写入: {out}")
    if fails:
        print("\n失败类型:", ", ".join(r["type"] for r in fails))
    if skips:
        print("跳过类型:", ", ".join(r["type"] for r in skips))
    return 1 if fails or skips else 0


if __name__ == "__main__":
    raise SystemExit(main())
