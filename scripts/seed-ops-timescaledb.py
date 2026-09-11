#!/usr/bin/env python3
"""向 sample-timescaledb 灌入大规模运维时序数据。

用法（需先 docker compose up -d sample-timescaledb）:
  cd backend && python ../scripts/seed-ops-timescaledb.py
  cd backend && python ../scripts/seed-ops-timescaledb.py --days 30 --truncate

默认: 14 天 × 1 分钟粒度，约 80 万+ 主机指标行 + 服务/Pod/告警/拨测/日志/备份。
"""
from __future__ import annotations

import argparse
import math
import random
import sys
import time
from datetime import datetime, timedelta, timezone

try:
    import psycopg
except ImportError:
    print("需要 psycopg：cd backend && pip install -e '.[connectors-ext]'", file=sys.stderr)
    sys.exit(1)

DEFAULT_DSN = "postgresql://vitalspan:vitalspan@127.0.0.1:5434/ops_tsdb"
BATCH = 5000

NAMESPACES = ("production", "staging", "monitoring", "data-platform", "bi")
PROBE_TARGETS = (
    ("https://api.example.com/health", "http", "华北"),
    ("https://order.example.com/health", "http", "华东"),
    ("https://pay.example.com/health", "http", "华南"),
    ("tcp://mysql-primary:3306", "tcp", "华北"),
    ("tcp://redis-cache:6379", "tcp", "华东"),
    ("dns://grafana.internal", "dns", "西南"),
)
LOG_LEVELS = ("debug", "info", "warn", "error", "fatal")
BACKUP_TYPES = ("full", "incremental", "binlog", "snapshot")
ALERT_STATUSES = ("firing", "resolved", "acknowledged")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Seed ops time-series data into TimescaleDB")
    p.add_argument("--dsn", default=DEFAULT_DSN)
    p.add_argument("--days", type=int, default=14, help="历史天数（默认 14）")
    p.add_argument("--step-minutes", type=int, default=1, help="采样间隔分钟（默认 1）")
    p.add_argument("--rows", type=int, default=None, help="快速模式：仅灌 host_metrics 指定行数（如 1000）")
    p.add_argument("--truncate", action="store_true", help="清空时序表后重灌")
    p.add_argument("--seed", type=int, default=42)
    return p.parse_args()


def seasonal(hour: int, base: float, amp: float) -> float:
    """工作日高峰 + 夜间低谷。"""
    daily = math.sin((hour - 8) * math.pi / 12) * amp
    return base + daily


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def load_ids(cur: psycopg.Cursor) -> dict[str, list]:
    cur.execute("SELECT id FROM dim_host WHERE status = 'active' ORDER BY id")
    hosts = [r[0] for r in cur.fetchall()]
    cur.execute("SELECT id, cluster_id FROM dim_host ORDER BY id")
    host_cluster = {r[0]: r[1] for r in cur.fetchall()}
    cur.execute("SELECT id FROM dim_service ORDER BY id")
    services = [r[0] for r in cur.fetchall()]
    cur.execute("SELECT id FROM dim_cluster ORDER BY id")
    clusters = [r[0] for r in cur.fetchall()]
    cur.execute("SELECT id FROM dim_alert_rule ORDER BY id")
    rules = [r[0] for r in cur.fetchall()]
    return {
        "hosts": hosts,
        "host_cluster": host_cluster,
        "services": services,
        "clusters": clusters,
        "rules": rules,
    }


def truncate_metrics(cur: psycopg.Cursor) -> None:
    tables = (
        "host_metrics",
        "service_metrics",
        "k8s_pod_metrics",
        "alert_events",
        "synthetic_probe",
        "log_volume_hourly",
        "backup_jobs",
    )
    for t in tables:
        cur.execute(f"TRUNCATE {t}")


def seed_host_metrics(
    cur: psycopg.Cursor,
    *,
    hosts: list[int],
    start: datetime,
    end: datetime,
    step: timedelta,
    rng: random.Random,
) -> int:
    rows: list[tuple] = []
    total = 0
    t = start
    host_profiles = {
        h: {
            "cpu_base": rng.uniform(25, 55),
            "mem_base": rng.uniform(40, 70),
            "disk_base": rng.uniform(50, 75),
        }
        for h in hosts
    }
    while t <= end:
        hour = t.hour
        for host_id in hosts:
            p = host_profiles[host_id]
            spike = 15 if rng.random() < 0.002 else 0
            cpu = clamp(seasonal(hour, p["cpu_base"], 12) + spike + rng.gauss(0, 3), 2, 99)
            mem = clamp(seasonal(hour, p["mem_base"], 8) + rng.gauss(0, 2), 10, 98)
            disk = clamp(p["disk_base"] + (t - start).days * 0.05 + rng.gauss(0, 1), 20, 97)
            rows.append(
                (
                    t,
                    host_id,
                    round(cpu, 2),
                    round(mem, 2),
                    round(disk, 2),
                    round(rng.uniform(5, 120), 2),
                    round(rng.uniform(2, 80), 2),
                    round(rng.uniform(10, 200), 2),
                    round(rng.uniform(8, 180), 2),
                    round(cpu / 20 + rng.gauss(0, 0.3), 2),
                    round(rng.uniform(15, 60), 2),
                )
            )
            if len(rows) >= BATCH:
                cur.executemany(
                    """INSERT INTO host_metrics
                    (time, host_id, cpu_pct, mem_pct, disk_pct, disk_read_mbps, disk_write_mbps,
                     net_in_mbps, net_out_mbps, load_1m, inode_pct) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    rows,
                )
                total += len(rows)
                rows.clear()
        t += step
    if rows:
        cur.executemany(
            """INSERT INTO host_metrics
            (time, host_id, cpu_pct, mem_pct, disk_pct, disk_read_mbps, disk_write_mbps,
             net_in_mbps, net_out_mbps, load_1m, inode_pct) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            rows,
        )
        total += len(rows)
    return total


def seed_host_metrics_fixed_rows(
    cur: psycopg.Cursor,
    *,
    hosts: list[int],
    row_count: int,
    rng: random.Random,
) -> int:
    """快速联调：向 host_metrics 写入固定行数（按分钟回溯）。"""
    if row_count <= 0 or not hosts:
        return 0

    end = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    rows: list[tuple] = []
    for i in range(row_count):
        host_id = hosts[i % len(hosts)]
        t = end - timedelta(minutes=row_count - 1 - i)
        hour = t.hour
        cpu = clamp(seasonal(hour, 35, 10) + rng.gauss(0, 3), 2, 99)
        mem = clamp(seasonal(hour, 55, 8) + rng.gauss(0, 2), 10, 98)
        disk = clamp(60 + rng.gauss(0, 2), 20, 97)
        rows.append(
            (
                t,
                host_id,
                round(cpu, 2),
                round(mem, 2),
                round(disk, 2),
                round(rng.uniform(5, 120), 2),
                round(rng.uniform(2, 80), 2),
                round(rng.uniform(10, 200), 2),
                round(rng.uniform(8, 180), 2),
                round(cpu / 20 + rng.gauss(0, 0.3), 2),
                round(rng.uniform(15, 60), 2),
            )
        )

    cur.executemany(
        """INSERT INTO host_metrics
        (time, host_id, cpu_pct, mem_pct, disk_pct, disk_read_mbps, disk_write_mbps,
         net_in_mbps, net_out_mbps, load_1m, inode_pct) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        rows,
    )
    return len(rows)


def seed_service_metrics(
    cur: psycopg.Cursor,
    *,
    services: list[int],
    clusters: list[int],
    start: datetime,
    end: datetime,
    step: timedelta,
    rng: random.Random,
) -> int:
    rows: list[tuple] = []
    total = 0
    t = start
    svc_profile = {s: {"qps": rng.uniform(50, 800), "lat": rng.uniform(20, 80)} for s in services}
    while t <= end:
        hour = t.hour
        for svc_id in services:
            cluster_id = rng.choice(clusters)
            prof = svc_profile[svc_id]
            qps = max(1, seasonal(hour, prof["qps"], prof["qps"] * 0.4) + rng.gauss(0, prof["qps"] * 0.05))
            p50 = max(1, prof["lat"] + rng.gauss(0, 5))
            p99 = p50 * rng.uniform(2, 5)
            err = 0.001 if rng.random() > 0.01 else rng.uniform(0.02, 0.12)
            rows.append(
                (
                    t,
                    svc_id,
                    cluster_id,
                    round(qps, 2),
                    round(p50, 2),
                    round(p99, 2),
                    round(err, 5),
                    int(qps * rng.uniform(0.5, 2)),
                )
            )
            if len(rows) >= BATCH:
                cur.executemany(
                    """INSERT INTO service_metrics
                    (time, service_id, cluster_id, qps, latency_p50_ms, latency_p99_ms,
                     error_rate, active_connections) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                    rows,
                )
                total += len(rows)
                rows.clear()
        t += step
    if rows:
        cur.executemany(
            """INSERT INTO service_metrics
            (time, service_id, cluster_id, qps, latency_p50_ms, latency_p99_ms,
             error_rate, active_connections) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
            rows,
        )
        total += len(rows)
    return total


def seed_k8s_pod_metrics(
    cur: psycopg.Cursor,
    *,
    clusters: list[int],
    start: datetime,
    end: datetime,
    step: timedelta,
    rng: random.Random,
    pods_per_svc: int = 2,
) -> int:
    pods = [
        (cid, ns, f"{ns}-{svc}-{i:02d}")
        for cid in clusters
        for ns in NAMESPACES[:2]
        for svc in ("api", "worker", "web")
        for i in range(1, pods_per_svc + 1)
    ]
    rows: list[tuple] = []
    total = 0
    t = start
    while t <= end:
        for cluster_id, namespace, pod_name in pods:
            rows.append(
                (
                    t,
                    cluster_id,
                    namespace,
                    pod_name,
                    int(rng.uniform(50, 1500)),
                    int(rng.uniform(64, 2048)),
                    rng.randint(0, 3) if rng.random() < 0.001 else 0,
                )
            )
            if len(rows) >= BATCH:
                cur.executemany(
                    """INSERT INTO k8s_pod_metrics
                    (time, cluster_id, namespace, pod_name, cpu_millicores, mem_mib, restart_count)
                    VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                    rows,
                )
                total += len(rows)
                rows.clear()
        t += step
    if rows:
        cur.executemany(
            """INSERT INTO k8s_pod_metrics
            (time, cluster_id, namespace, pod_name, cpu_millicores, mem_mib, restart_count)
            VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            rows,
        )
        total += len(rows)
    return total


def seed_alert_events(
    cur: psycopg.Cursor,
    *,
    rules: list[int],
    hosts: list[int],
    services: list[int],
    start: datetime,
    end: datetime,
    rng: random.Random,
) -> int:
    rows: list[tuple] = []
    t = start
    messages = (
        "CPU 持续 5 分钟超过阈值",
        "磁盘使用率突破 85%",
        "P99 延迟超过 500ms",
        "拨测连续失败 3 次",
        "Pod 重启次数异常",
        "备份任务执行失败",
    )
    while t <= end:
        if rng.random() < 0.08:
            rows.append(
                (
                    t,
                    rng.choice(rules),
                    rng.choice(hosts) if rng.random() < 0.6 else None,
                    rng.choice(services) if rng.random() < 0.5 else None,
                    rng.choice(ALERT_STATUSES),
                    round(rng.uniform(0, 100), 2),
                    rng.choice(messages),
                )
            )
        t += timedelta(minutes=rng.randint(5, 30))
    cur.executemany(
        """INSERT INTO alert_events
        (time, rule_id, host_id, service_id, status, metric_value, message)
        VALUES (%s,%s,%s,%s,%s,%s,%s)""",
        rows,
    )
    return len(rows)


def seed_synthetic_probe(
    cur: psycopg.Cursor,
    *,
    start: datetime,
    end: datetime,
    rng: random.Random,
) -> int:
    rows: list[tuple] = []
    t = start
    while t <= end:
        for target, probe_type, region in PROBE_TARGETS:
            fail = rng.random() < 0.02
            rows.append(
                (
                    t,
                    target,
                    probe_type,
                    region,
                    not fail,
                    round(rng.uniform(5, 80) if not fail else rng.uniform(200, 3000), 2),
                )
            )
        t += timedelta(minutes=5)
    cur.executemany(
        """INSERT INTO synthetic_probe
        (time, target, probe_type, region, success, latency_ms) VALUES (%s,%s,%s,%s,%s,%s)""",
        rows,
    )
    return len(rows)


def seed_log_volume(
    cur: psycopg.Cursor,
    *,
    services: list[int],
    start: datetime,
    end: datetime,
    rng: random.Random,
) -> int:
    rows: list[tuple] = []
    t = start.replace(minute=0, second=0, microsecond=0)
    while t <= end:
        for svc_id in services:
            for level in LOG_LEVELS:
                base = {"debug": 5000, "info": 20000, "warn": 800, "error": 120, "fatal": 5}[level]
                rows.append((t, svc_id, level, int(base * rng.uniform(0.5, 1.8))))
        t += timedelta(hours=1)
    cur.executemany(
        "INSERT INTO log_volume_hourly (time, service_id, log_level, line_count) VALUES (%s,%s,%s,%s)",
        rows,
    )
    return len(rows)


def seed_backup_jobs(
    cur: psycopg.Cursor,
    *,
    hosts: list[int],
    start: datetime,
    end: datetime,
    rng: random.Random,
) -> int:
    backup_hosts = [h for h in hosts if h % 3 == 0][:12] or hosts[:6]
    rows: list[tuple] = []
    t = start.replace(hour=2, minute=0, second=0, microsecond=0)
    while t <= end:
        for host_id in backup_hosts:
            ok = rng.random() > 0.03
            rows.append(
                (
                    t,
                    host_id,
                    rng.choice(BACKUP_TYPES),
                    "success" if ok else "failed",
                    int(rng.uniform(300, 7200)),
                    round(rng.uniform(10, 500), 2),
                )
            )
        t += timedelta(days=1)
    cur.executemany(
        """INSERT INTO backup_jobs
        (time, host_id, job_type, status, duration_sec, size_gb) VALUES (%s,%s,%s,%s,%s,%s)""",
        rows,
    )
    return len(rows)


def main() -> None:
    args = parse_args()
    rng = random.Random(args.seed)
    end = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    start = end - timedelta(days=args.days)
    step = timedelta(minutes=args.step_minutes)

    print(f"连接 {args.dsn}", flush=True)
    t0 = time.perf_counter()
    with psycopg.connect(args.dsn, autocommit=False) as conn:
        with conn.cursor() as cur:
            if args.truncate:
                print("清空时序表…")
                truncate_metrics(cur)
                conn.commit()

            ids = load_ids(cur)
            hosts = ids["hosts"]
            if not hosts:
                print("未找到 dim_host，请先执行 docker compose 初始化 SQL", file=sys.stderr)
                sys.exit(1)

            if args.rows is not None:
                print(f"快速模式：灌入 host_metrics {args.rows:,} 行…")
                n_host = seed_host_metrics_fixed_rows(cur, hosts=hosts, row_count=args.rows, rng=rng)
                conn.commit()
                print(f"  → {n_host:,} 行")
            else:
                print(f"灌入 host_metrics（{len(hosts)} 主机, {args.days} 天）…")
                n_host = seed_host_metrics(cur, hosts=hosts, start=start, end=end, step=step, rng=rng)
                conn.commit()
                print(f"  → {n_host:,} 行")

                print("灌入 service_metrics…")
                n_svc = seed_service_metrics(
                    cur,
                    services=ids["services"],
                    clusters=ids["clusters"],
                    start=start,
                    end=end,
                    step=step,
                    rng=rng,
                )
                conn.commit()
                print(f"  → {n_svc:,} 行")

                print("灌入 k8s_pod_metrics…")
                n_pod = seed_k8s_pod_metrics(
                    cur, clusters=ids["clusters"], start=start, end=end, step=step, rng=rng
                )
                conn.commit()
                print(f"  → {n_pod:,} 行")

                print("灌入 alert_events / synthetic_probe / log_volume / backup_jobs…")
                n_alert = seed_alert_events(
                    cur,
                    rules=ids["rules"],
                    hosts=hosts,
                    services=ids["services"],
                    start=start,
                    end=end,
                    rng=rng,
                )
                n_probe = seed_synthetic_probe(cur, start=start, end=end, rng=rng)
                n_log = seed_log_volume(cur, services=ids["services"], start=start, end=end, rng=rng)
                n_bak = seed_backup_jobs(cur, hosts=hosts, start=start, end=end, rng=rng)
                conn.commit()
                print(f"  → alerts={n_alert:,} probes={n_probe:,} logs={n_log:,} backups={n_bak:,}")

            print("\n=== 行数统计 ===")
            for table in (
                "host_metrics",
                "service_metrics",
                "k8s_pod_metrics",
                "alert_events",
                "synthetic_probe",
                "log_volume_hourly",
                "backup_jobs",
            ):
                cur.execute(f"SELECT count(*) FROM {table}")
                cnt = cur.fetchone()[0]
                print(f"  {table}: {cnt:,} 行")

    elapsed = time.perf_counter() - t0
    print(f"\n完成，耗时 {elapsed:.1f}s")
    print("\n=== VitalSpan 数据源连接 ===")
    print("类型: TimescaleDB")
    print("主机: 127.0.0.1  端口: 5434")
    print("数据库: ops_tsdb  用户: vitalspan  密码: vitalspan")


if __name__ == "__main__":
    main()
