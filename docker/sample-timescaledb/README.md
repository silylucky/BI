# 运维监控时序库（TimescaleDB）

面向 VitalSpan **功能测试 / 图表联调** 的运维场景演示库，含主机、服务、K8s、告警、拨测、日志、备份等完整维度与时序数据。

## 快速启动

```powershell
# 项目根目录
.\scripts\seed-ops-timescaledb.ps1

# 可选：30 天数据
.\scripts\seed-ops-timescaledb.ps1 --days 30
```

或手动：

```bash
docker compose up -d sample-timescaledb
cd backend && python ../scripts/seed-ops-timescaledb.py --truncate
```

## 连接参数（VitalSpan 数据源）

| 项 | 值 |
|---|---|
| 类型 | **TimescaleDB** |
| 主机 | `127.0.0.1` |
| 端口 | `5434` |
| 数据库 | `ops_tsdb` |
| 用户名 | `vitalspan` |
| 密码 | `vitalspan` |

管理端：**数据源 → 新建 → TimescaleDB → 测试连接 → 保存**

## 数据规模（默认 14 天）

| 表 | 说明 | 约行数 |
|---|---|---|
| `host_metrics` | 主机 CPU/内存/磁盘/网络，1 分钟粒度 | ~60 万 |
| `service_metrics` | 服务 QPS、延迟、错误率 | ~40 万 |
| `k8s_pod_metrics` | Pod CPU/内存/重启 | ~50 万+ |
| `alert_events` | 告警触发/恢复 | ~数千 |
| `synthetic_probe` | HTTP/TCP/DNS 拨测 | ~2 万 |
| `log_volume_hourly` | 按服务/级别日志量 | ~1 万 |
| `backup_jobs` | 备份任务结果 | ~数百 |

维度：4 机房 · 8 集群 · 40 主机 · 25 微服务 · 15 告警规则

## 功能测试清单

### 1. 数据源与元数据

- [ ] 新建 TimescaleDB 数据源，测试连接成功
- [ ] 浏览 schema `public`，可见 7 个 **hypertable**（类型显示为 hypertable）
- [ ] 浏览 `dim_*` 维度表列信息
- [ ] 浏览视图 `v_host_metrics_latest`、`v_service_slo_daily`

### 2. SQL 图表（直连模式）

**折线图 — 集群 CPU 均值（近 24h）**

```sql
SELECT
  time_bucket('15 minutes', m.time) AS bucket,
  c.name AS cluster,
  round(avg(m.cpu_pct)::numeric, 2) AS avg_cpu
FROM host_metrics m
JOIN dim_host h ON h.id = m.host_id
JOIN dim_cluster c ON c.id = h.cluster_id
WHERE m.time > now() - interval '24 hours'
GROUP BY 1, 2
ORDER BY 1, 2;
```

维度：`bucket` · 指标：`avg_cpu` · 系列：`cluster`

**柱状图 — 各服务日均错误率**

```sql
SELECT
  date_trunc('day', m.time)::date AS day,
  s.name AS service,
  round(avg(m.error_rate) * 100, 3) AS error_pct
FROM service_metrics m
JOIN dim_service s ON s.id = m.service_id
WHERE m.time > now() - interval '7 days'
GROUP BY 1, 2
ORDER BY 1, error_pct DESC;
```

**表格 — 最新主机资源快照**

```sql
SELECT * FROM v_host_metrics_latest
ORDER BY cpu_pct DESC
LIMIT 20;
```

**饼图 — 告警按严重级别分布**

```sql
SELECT r.severity, count(*) AS cnt
FROM alert_events e
JOIN dim_alert_rule r ON r.id = e.rule_id
WHERE e.time > now() - interval '7 days'
GROUP BY 1;
```

**地图/区域（用机房维度）— 拨测成功率**

```sql
SELECT
  region,
  round(100.0 * avg(CASE WHEN success THEN 1 ELSE 0 END), 2) AS success_rate
FROM synthetic_probe
WHERE time > now() - interval '24 hours'
GROUP BY 1;
```

### 3. 看板场景

- [ ] **运维总览**：KPI 卡片（平均 CPU、告警数、拨测成功率）+ 折线 + 表格
- [ ] **服务 SLO**：`v_service_slo_daily` 趋势 + 错误率 TopN 柱状图
- [ ] **主机资源**：`v_host_metrics_latest` 表格 + CPU 时序折线
- [ ] **过滤器**：按 `dim_environment`（prod/staging）或 `dim_datacenter` 筛选（SQL WHERE）

### 4. 边界与回归

- [ ] 时间范围筛选（近 1h / 24h / 7d）结果合理
- [ ] 大结果集表格分页不超时（host_metrics 抽样查询）
- [ ] 重灌数据：`.\scripts\seed-ops-timescaledb.ps1 --days 7` 后图表刷新正常

## 重灌 / 重置

```powershell
# 保留卷，仅清空时序表重灌
.\scripts\seed-ops-timescaledb.ps1 --days 14

# 完全重建（删卷）
docker compose down sample-timescaledb -v
docker compose up -d sample-timescaledb
.\scripts\seed-ops-timescaledb.ps1
```

## 集成测试

```bash
docker compose up -d sample-timescaledb
cd backend && python ../scripts/seed-ops-timescaledb.py --days 3 --truncate
pytest tests/test_ops_tsdb_compose.py -m integration
```
