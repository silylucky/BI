-- VitalSpan 运维监控演示库 — TimescaleDB 表结构
-- 数据库: ops_tsdb  用户: vitalspan / vitalspan  端口: 5434

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ---------- 维度表 ----------

CREATE TABLE IF NOT EXISTS dim_datacenter (
  id          SMALLSERIAL PRIMARY KEY,
  code        VARCHAR(16)  NOT NULL UNIQUE,
  name        VARCHAR(64)  NOT NULL,
  region      VARCHAR(32)  NOT NULL,
  tier        VARCHAR(16)  NOT NULL DEFAULT 'standard'
);

CREATE TABLE IF NOT EXISTS dim_environment (
  id          SMALLSERIAL PRIMARY KEY,
  code        VARCHAR(16)  NOT NULL UNIQUE,
  name        VARCHAR(32)  NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_cluster (
  id              SMALLSERIAL PRIMARY KEY,
  code            VARCHAR(32)  NOT NULL UNIQUE,
  name            VARCHAR(64)  NOT NULL,
  datacenter_id   SMALLINT     NOT NULL REFERENCES dim_datacenter(id),
  environment_id  SMALLINT     NOT NULL REFERENCES dim_environment(id),
  k8s_version     VARCHAR(16)  NOT NULL,
  node_count      SMALLINT     NOT NULL DEFAULT 3
);

CREATE TABLE IF NOT EXISTS dim_host (
  id              SERIAL PRIMARY KEY,
  hostname        VARCHAR(64)  NOT NULL UNIQUE,
  ip_address      INET         NOT NULL,
  cluster_id      SMALLINT     NOT NULL REFERENCES dim_cluster(id),
  os_family       VARCHAR(16)  NOT NULL,
  role            VARCHAR(32)  NOT NULL,
  cpu_cores       SMALLINT     NOT NULL,
  mem_gb          SMALLINT     NOT NULL,
  disk_gb         INT          NOT NULL,
  status          VARCHAR(16)  NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS dim_service (
  id          SMALLSERIAL PRIMARY KEY,
  code        VARCHAR(32)  NOT NULL UNIQUE,
  name        VARCHAR(64)  NOT NULL,
  team        VARCHAR(32)  NOT NULL,
  tier        VARCHAR(8)   NOT NULL,
  language    VARCHAR(16)  NOT NULL,
  slo_target  NUMERIC(5,2) NOT NULL DEFAULT 99.90
);

CREATE TABLE IF NOT EXISTS dim_alert_rule (
  id          SMALLSERIAL PRIMARY KEY,
  code        VARCHAR(32)  NOT NULL UNIQUE,
  name        VARCHAR(128) NOT NULL,
  severity    VARCHAR(16)  NOT NULL,
  metric      VARCHAR(64)  NOT NULL,
  threshold   NUMERIC(12,4) NOT NULL,
  unit        VARCHAR(16)  NOT NULL DEFAULT ''
);

-- ---------- 时序 Hypertable ----------

CREATE TABLE IF NOT EXISTS host_metrics (
  time            TIMESTAMPTZ      NOT NULL,
  host_id         INT              NOT NULL REFERENCES dim_host(id),
  cpu_pct         DOUBLE PRECISION NOT NULL,
  mem_pct         DOUBLE PRECISION NOT NULL,
  disk_pct        DOUBLE PRECISION NOT NULL,
  disk_read_mbps  DOUBLE PRECISION NOT NULL DEFAULT 0,
  disk_write_mbps DOUBLE PRECISION NOT NULL DEFAULT 0,
  net_in_mbps     DOUBLE PRECISION NOT NULL DEFAULT 0,
  net_out_mbps    DOUBLE PRECISION NOT NULL DEFAULT 0,
  load_1m         DOUBLE PRECISION NOT NULL DEFAULT 0,
  inode_pct       DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS service_metrics (
  time              TIMESTAMPTZ      NOT NULL,
  service_id        SMALLINT         NOT NULL REFERENCES dim_service(id),
  cluster_id        SMALLINT         NOT NULL REFERENCES dim_cluster(id),
  qps               DOUBLE PRECISION NOT NULL DEFAULT 0,
  latency_p50_ms    DOUBLE PRECISION NOT NULL DEFAULT 0,
  latency_p99_ms    DOUBLE PRECISION NOT NULL DEFAULT 0,
  error_rate        DOUBLE PRECISION NOT NULL DEFAULT 0,
  active_connections INT             NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS k8s_pod_metrics (
  time            TIMESTAMPTZ      NOT NULL,
  cluster_id      SMALLINT         NOT NULL REFERENCES dim_cluster(id),
  namespace       VARCHAR(64)      NOT NULL,
  pod_name        VARCHAR(128)     NOT NULL,
  cpu_millicores  INT              NOT NULL,
  mem_mib         INT              NOT NULL,
  restart_count   INT              NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS alert_events (
  time            TIMESTAMPTZ      NOT NULL,
  rule_id         SMALLINT         NOT NULL REFERENCES dim_alert_rule(id),
  host_id         INT              NULL REFERENCES dim_host(id),
  service_id      SMALLINT         NULL REFERENCES dim_service(id),
  status          VARCHAR(16)      NOT NULL,
  metric_value    DOUBLE PRECISION NULL,
  message         TEXT             NOT NULL
);

CREATE TABLE IF NOT EXISTS synthetic_probe (
  time            TIMESTAMPTZ      NOT NULL,
  target          VARCHAR(128)     NOT NULL,
  probe_type      VARCHAR(32)      NOT NULL,
  region          VARCHAR(32)      NOT NULL,
  success         BOOLEAN          NOT NULL,
  latency_ms      DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS log_volume_hourly (
  time            TIMESTAMPTZ      NOT NULL,
  service_id      SMALLINT         NOT NULL REFERENCES dim_service(id),
  log_level       VARCHAR(16)      NOT NULL,
  line_count      BIGINT           NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS backup_jobs (
  time            TIMESTAMPTZ      NOT NULL,
  host_id         INT              NOT NULL REFERENCES dim_host(id),
  job_type        VARCHAR(32)      NOT NULL,
  status          VARCHAR(16)      NOT NULL,
  duration_sec    INT              NOT NULL DEFAULT 0,
  size_gb         DOUBLE PRECISION NOT NULL DEFAULT 0
);

SELECT create_hypertable('host_metrics', 'time', if_not_exists => TRUE, chunk_time_interval => INTERVAL '1 day');
SELECT create_hypertable('service_metrics', 'time', if_not_exists => TRUE, chunk_time_interval => INTERVAL '1 day');
SELECT create_hypertable('k8s_pod_metrics', 'time', if_not_exists => TRUE, chunk_time_interval => INTERVAL '1 day');
SELECT create_hypertable('alert_events', 'time', if_not_exists => TRUE, chunk_time_interval => INTERVAL '7 days');
SELECT create_hypertable('synthetic_probe', 'time', if_not_exists => TRUE, chunk_time_interval => INTERVAL '1 day');
SELECT create_hypertable('log_volume_hourly', 'time', if_not_exists => TRUE, chunk_time_interval => INTERVAL '7 days');
SELECT create_hypertable('backup_jobs', 'time', if_not_exists => TRUE, chunk_time_interval => INTERVAL '7 days');

CREATE INDEX IF NOT EXISTS idx_host_metrics_host_time ON host_metrics (host_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_service_metrics_svc_time ON service_metrics (service_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_k8s_pod_cluster_time ON k8s_pod_metrics (cluster_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_status_time ON alert_events (status, time DESC);

-- ---------- 常用分析视图（BI 直连 SQL 用）----------

CREATE OR REPLACE VIEW v_host_metrics_latest AS
SELECT DISTINCT ON (h.id)
  h.hostname,
  c.name AS cluster_name,
  dc.name AS datacenter,
  e.name AS environment,
  m.time,
  m.cpu_pct,
  m.mem_pct,
  m.disk_pct,
  m.load_1m
FROM host_metrics m
JOIN dim_host h ON h.id = m.host_id
JOIN dim_cluster c ON c.id = h.cluster_id
JOIN dim_datacenter dc ON dc.id = c.datacenter_id
JOIN dim_environment e ON e.id = c.environment_id
ORDER BY h.id, m.time DESC;

CREATE OR REPLACE VIEW v_service_slo_daily AS
SELECT
  date_trunc('day', m.time) AS day,
  s.code AS service_code,
  s.name AS service_name,
  s.team,
  avg(m.error_rate) AS avg_error_rate,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY m.latency_p99_ms) AS p99_latency_ms,
  avg(m.qps) AS avg_qps
FROM service_metrics m
JOIN dim_service s ON s.id = m.service_id
GROUP BY 1, 2, 3, 4;
