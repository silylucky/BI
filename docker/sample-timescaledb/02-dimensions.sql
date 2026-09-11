-- 运维维度种子数据（UTF-8）

INSERT INTO dim_datacenter (code, name, region, tier) VALUES
  ('dc-bj', '北京亦庄', '华北', 'core'),
  ('dc-sh', '上海外高桥', '华东', 'core'),
  ('dc-gz', '广州南沙', '华南', 'standard'),
  ('dc-cd', '成都高新', '西南', 'edge')
ON CONFLICT (code) DO NOTHING;

INSERT INTO dim_environment (code, name) VALUES
  ('prod', '生产'),
  ('staging', '预发'),
  ('dev', '开发')
ON CONFLICT (code) DO NOTHING;

INSERT INTO dim_cluster (code, name, datacenter_id, environment_id, k8s_version, node_count) VALUES
  ('k8s-bj-prod-a', '北京生产-A', 1, 1, '1.29', 12),
  ('k8s-bj-prod-b', '北京生产-B', 1, 1, '1.29', 10),
  ('k8s-sh-prod-a', '上海生产-A', 2, 1, '1.28', 14),
  ('k8s-gz-prod-a', '广州生产-A', 3, 1, '1.28', 8),
  ('k8s-bj-stg', '北京预发', 1, 2, '1.29', 6),
  ('k8s-sh-stg', '上海预发', 2, 2, '1.28', 5),
  ('k8s-cd-dev', '成都开发', 4, 3, '1.27', 4),
  ('k8s-bj-dev', '北京开发', 1, 3, '1.27', 3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO dim_service (code, name, team, tier, language, slo_target) VALUES
  ('api-gateway', 'API 网关', '平台', 'P0', 'go', 99.95),
  ('order-svc', '订单服务', '交易', 'P0', 'java', 99.90),
  ('payment-svc', '支付服务', '交易', 'P0', 'java', 99.99),
  ('user-svc', '用户中心', '会员', 'P1', 'java', 99.90),
  ('catalog-svc', '商品目录', '商品', 'P1', 'go', 99.85),
  ('inventory-svc', '库存服务', '供应链', 'P1', 'java', 99.85),
  ('search-svc', '搜索服务', '数据', 'P1', 'java', 99.80),
  ('recommend-svc', '推荐引擎', '数据', 'P2', 'python', 99.50),
  ('notify-svc', '消息通知', '平台', 'P1', 'go', 99.90),
  ('report-svc', '报表服务', 'BI', 'P1', 'python', 99.50),
  ('auth-svc', '认证服务', '安全', 'P0', 'go', 99.95),
  ('file-svc', '文件服务', '平台', 'P2', 'go', 99.80),
  ('etl-worker', 'ETL 任务', '数据', 'P2', 'python', 99.00),
  ('scheduler', '调度中心', '平台', 'P1', 'java', 99.85),
  ('nginx-ingress', 'Ingress', 'SRE', 'P0', 'c', 99.99),
  ('redis-cache', 'Redis 集群', 'SRE', 'P0', 'c', 99.95),
  ('mysql-primary', 'MySQL 主库', 'DBA', 'P0', 'c', 99.99),
  ('postgres-analytics', '分析库 PG', 'DBA', 'P1', 'c', 99.90),
  ('kafka-broker', 'Kafka', '数据', 'P0', 'java', 99.90),
  ('prometheus', '监控采集', 'SRE', 'P1', 'go', 99.50),
  ('grafana', '监控看板', 'SRE', 'P2', 'go', 99.00),
  ('log-agent', '日志采集', 'SRE', 'P2', 'go', 99.00),
  ('backup-agent', '备份代理', 'SRE', 'P1', 'go', 99.50),
  ('ci-runner', 'CI Runner', '效能', 'P2', 'go', 98.00),
  ('vitalspan-api', 'VitalSpan API', 'BI', 'P1', 'python', 99.50)
ON CONFLICT (code) DO NOTHING;

INSERT INTO dim_alert_rule (code, name, severity, metric, threshold, unit) VALUES
  ('cpu-high', 'CPU 使用率过高', 'warning', 'cpu_pct', 85, '%'),
  ('cpu-critical', 'CPU 使用率危急', 'critical', 'cpu_pct', 95, '%'),
  ('mem-high', '内存使用率过高', 'warning', 'mem_pct', 80, '%'),
  ('disk-high', '磁盘使用率过高', 'warning', 'disk_pct', 85, '%'),
  ('disk-critical', '磁盘即将写满', 'critical', 'disk_pct', 95, '%'),
  ('load-high', '系统负载过高', 'warning', 'load_1m', 8, ''),
  ('error-rate', '服务错误率超标', 'critical', 'error_rate', 0.05, 'ratio'),
  ('latency-p99', 'P99 延迟超标', 'warning', 'latency_p99_ms', 500, 'ms'),
  ('probe-fail', '拨测失败', 'critical', 'probe_success', 0, 'bool'),
  ('pod-restart', 'Pod 频繁重启', 'warning', 'restart_count', 5, 'count'),
  ('backup-fail', '备份任务失败', 'critical', 'backup_status', 0, 'bool'),
  ('kafka-lag', 'Kafka 消费滞后', 'warning', 'consumer_lag', 10000, 'msgs'),
  ('mysql-conn', 'MySQL 连接数过高', 'warning', 'active_connections', 500, 'count'),
  ('ingress-5xx', 'Ingress 5xx 比例', 'critical', 'error_rate', 0.01, 'ratio'),
  ('slo-breach', 'SLO 违约', 'critical', 'slo_compliance', 99.9, '%')
ON CONFLICT (code) DO NOTHING;

-- 40 台主机（跨 8 个集群）
INSERT INTO dim_host (hostname, ip_address, cluster_id, os_family, role, cpu_cores, mem_gb, disk_gb, status) VALUES
  ('bj-prod-a-node-01', '10.1.1.11', 1, 'linux', 'worker', 32, 128, 2000, 'active'),
  ('bj-prod-a-node-02', '10.1.1.12', 1, 'linux', 'worker', 32, 128, 2000, 'active'),
  ('bj-prod-a-node-03', '10.1.1.13', 1, 'linux', 'worker', 16, 64, 1000, 'active'),
  ('bj-prod-a-master-01', '10.1.1.10', 1, 'linux', 'control-plane', 8, 32, 500, 'active'),
  ('bj-prod-b-node-01', '10.1.2.11', 2, 'linux', 'worker', 32, 128, 2000, 'active'),
  ('bj-prod-b-node-02', '10.1.2.12', 2, 'linux', 'worker', 32, 128, 2000, 'active'),
  ('bj-prod-b-node-03', '10.1.2.13', 2, 'linux', 'worker', 16, 64, 1000, 'maintenance'),
  ('sh-prod-a-node-01', '10.2.1.11', 3, 'linux', 'worker', 48, 256, 4000, 'active'),
  ('sh-prod-a-node-02', '10.2.1.12', 3, 'linux', 'worker', 48, 256, 4000, 'active'),
  ('sh-prod-a-node-03', '10.2.1.13', 3, 'linux', 'worker', 32, 128, 2000, 'active'),
  ('sh-prod-a-node-04', '10.2.1.14', 3, 'linux', 'worker', 32, 128, 2000, 'active'),
  ('sh-prod-a-master-01', '10.2.1.10', 3, 'linux', 'control-plane', 8, 32, 500, 'active'),
  ('gz-prod-a-node-01', '10.3.1.11', 4, 'linux', 'worker', 16, 64, 1000, 'active'),
  ('gz-prod-a-node-02', '10.3.1.12', 4, 'linux', 'worker', 16, 64, 1000, 'active'),
  ('gz-prod-a-node-03', '10.3.1.13', 4, 'linux', 'worker', 16, 64, 1000, 'active'),
  ('bj-stg-node-01', '10.1.10.11', 5, 'linux', 'worker', 8, 32, 500, 'active'),
  ('bj-stg-node-02', '10.1.10.12', 5, 'linux', 'worker', 8, 32, 500, 'active'),
  ('bj-stg-node-03', '10.1.10.13', 5, 'linux', 'worker', 8, 32, 500, 'active'),
  ('sh-stg-node-01', '10.2.10.11', 6, 'linux', 'worker', 8, 32, 500, 'active'),
  ('sh-stg-node-02', '10.2.10.12', 6, 'linux', 'worker', 8, 32, 500, 'active'),
  ('cd-dev-node-01', '10.4.1.11', 7, 'linux', 'worker', 4, 16, 200, 'active'),
  ('cd-dev-node-02', '10.4.1.12', 7, 'linux', 'worker', 4, 16, 200, 'active'),
  ('bj-dev-node-01', '10.1.20.11', 8, 'linux', 'worker', 4, 16, 200, 'active'),
  ('bj-dev-node-02', '10.1.20.12', 8, 'linux', 'worker', 4, 16, 200, 'active'),
  ('bj-prod-a-db-01', '10.1.1.21', 1, 'linux', 'database', 16, 128, 8000, 'active'),
  ('bj-prod-a-db-02', '10.1.1.22', 1, 'linux', 'database', 16, 128, 8000, 'active'),
  ('sh-prod-a-db-01', '10.2.1.21', 3, 'linux', 'database', 32, 256, 10000, 'active'),
  ('sh-prod-a-cache-01', '10.2.1.31', 3, 'linux', 'cache', 8, 64, 500, 'active'),
  ('sh-prod-a-cache-02', '10.2.1.32', 3, 'linux', 'cache', 8, 64, 500, 'active'),
  ('gz-prod-a-lb-01', '10.3.1.20', 4, 'linux', 'loadbalancer', 4, 8, 100, 'active'),
  ('bj-prod-a-mon-01', '10.1.1.41', 1, 'linux', 'monitoring', 8, 32, 2000, 'active'),
  ('sh-prod-a-mon-01', '10.2.1.41', 3, 'linux', 'monitoring', 8, 32, 2000, 'active'),
  ('bj-prod-b-mon-01', '10.1.2.41', 2, 'linux', 'monitoring', 8, 32, 2000, 'active'),
  ('bj-stg-mon-01', '10.1.10.41', 5, 'linux', 'monitoring', 4, 16, 500, 'active'),
  ('cd-dev-mon-01', '10.4.1.41', 7, 'linux', 'monitoring', 4, 16, 200, 'active'),
  ('bj-prod-a-log-01', '10.1.1.51', 1, 'linux', 'logging', 16, 64, 4000, 'active'),
  ('sh-prod-a-log-01', '10.2.1.51', 3, 'linux', 'logging', 16, 64, 4000, 'active'),
  ('bj-prod-a-bak-01', '10.1.1.61', 1, 'linux', 'backup', 8, 32, 10000, 'active'),
  ('sh-prod-a-bak-01', '10.2.1.61', 3, 'linux', 'backup', 8, 32, 10000, 'active'),
  ('gz-prod-a-edge-01', '10.3.1.71', 4, 'linux', 'edge', 4, 8, 200, 'active')
ON CONFLICT (hostname) DO NOTHING;
