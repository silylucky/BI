-- 官方演示事实表补齐至少 600 行（幂等：已达 600 则不再插入）
-- 维表 regions / geo_locations / product_categories 保持行政区与品类真值，供地图 join
SET SESSION cte_max_recursion_depth = 1000;

INSERT INTO products (sku, name, category_id, unit_price, cost_price, stock_qty)
WITH RECURSIVE seq AS (
  SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 600
),
cats AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn, COUNT(*) OVER () AS cnt
  FROM product_categories
)
SELECT
  CONCAT('SKU-PAD-', LPAD(seq.n, 4, '0')),
  CONCAT('演示商品 ', seq.n),
  cats.id,
  ROUND(99 + (seq.n % 90) * 10, 2),
  ROUND(50 + (seq.n % 40) * 8, 2),
  10 + (seq.n % 200)
FROM seq
JOIN cats ON cats.rn = 1 + MOD(seq.n - 1, cats.cnt)
WHERE seq.n > (SELECT COUNT(*) FROM products);

INSERT INTO customers (code, name, region_id, tier, register_date, contact_phone)
WITH RECURSIVE seq AS (
  SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 600
),
regs AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn, COUNT(*) OVER () AS cnt
  FROM regions WHERE level = 3
)
SELECT
  CONCAT('C-PAD-', LPAD(seq.n, 4, '0')),
  CONCAT('演示客户 ', seq.n),
  regs.id,
  ELT(1 + MOD(seq.n - 1, 3), '普通', 'VIP', '企业'),
  DATE_ADD('2023-01-01', INTERVAL MOD(seq.n, 700) DAY),
  CONCAT('138', LPAD(seq.n, 8, '0'))
FROM seq
JOIN regs ON regs.rn = 1 + MOD(seq.n - 1, regs.cnt)
WHERE seq.n > (SELECT COUNT(*) FROM customers);

INSERT INTO employees (emp_no, name, department, region_id, hire_date, salary)
WITH RECURSIVE seq AS (
  SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 600
),
regs AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn, COUNT(*) OVER () AS cnt
  FROM regions WHERE level = 1
)
SELECT
  CONCAT('E-PAD-', LPAD(seq.n, 4, '0')),
  CONCAT('演示员工 ', seq.n),
  ELT(1 + MOD(seq.n - 1, 4), '销售一部', '销售二部', '数据分析', '技术支持'),
  regs.id,
  DATE_ADD('2018-01-01', INTERVAL MOD(seq.n, 2000) DAY),
  ROUND(8000 + (seq.n % 80) * 100, 2)
FROM seq
JOIN regs ON regs.rn = 1 + MOD(seq.n - 1, regs.cnt)
WHERE seq.n > (SELECT COUNT(*) FROM employees);

INSERT INTO sales (sale_date, region_id, product_id, customer_id, quantity, amount, channel)
WITH RECURSIVE seq AS (
  SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 600
),
regs AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn, COUNT(*) OVER () AS cnt
  FROM regions WHERE level = 3
),
prods AS (
  SELECT id, unit_price, ROW_NUMBER() OVER (ORDER BY id) AS rn, COUNT(*) OVER () AS cnt
  FROM products
),
custs AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn, COUNT(*) OVER () AS cnt
  FROM customers
)
SELECT
  DATE_ADD('2024-01-01', INTERVAL MOD(seq.n, 540) DAY),
  regs.id,
  prods.id,
  custs.id,
  1 + MOD(seq.n, 12),
  ROUND(prods.unit_price * (1 + MOD(seq.n, 12)), 2),
  ELT(1 + MOD(seq.n - 1, 4), '线下门店', '电商平台', '企业直销', '电话销售')
FROM seq
JOIN regs ON regs.rn = 1 + MOD(seq.n - 1, regs.cnt)
JOIN prods ON prods.rn = 1 + MOD(seq.n - 1, prods.cnt)
JOIN custs ON custs.rn = 1 + MOD(seq.n - 1, custs.cnt)
WHERE seq.n > (SELECT COUNT(*) FROM sales);

INSERT INTO orders (order_no, order_date, customer_id, region_id, status, total_amount, salesperson_id)
WITH RECURSIVE seq AS (
  SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 600
),
custs AS (
  SELECT id, region_id, ROW_NUMBER() OVER (ORDER BY id) AS rn, COUNT(*) OVER () AS cnt
  FROM customers
),
emps AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn, COUNT(*) OVER () AS cnt
  FROM employees
)
SELECT
  CONCAT('ORD-PAD-', LPAD(seq.n, 4, '0')),
  DATE_ADD('2024-01-01', INTERVAL MOD(seq.n, 540) DAY),
  custs.id,
  custs.region_id,
  ELT(1 + MOD(seq.n - 1, 4), '已完成', '待发货', '已取消', '处理中'),
  ROUND(500 + (seq.n % 90) * 80, 2),
  emps.id
FROM seq
JOIN custs ON custs.rn = 1 + MOD(seq.n - 1, custs.cnt)
JOIN emps ON emps.rn = 1 + MOD(seq.n - 1, emps.cnt)
WHERE seq.n > (SELECT COUNT(*) FROM orders);

INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
WITH RECURSIVE seq AS (
  SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 600
),
ords AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn, COUNT(*) OVER () AS cnt
  FROM orders
),
prods AS (
  SELECT id, unit_price, ROW_NUMBER() OVER (ORDER BY id) AS rn, COUNT(*) OVER () AS cnt
  FROM products
)
SELECT
  ords.id,
  prods.id,
  1 + MOD(seq.n, 8),
  prods.unit_price,
  ROUND(prods.unit_price * (1 + MOD(seq.n, 8)), 2)
FROM seq
JOIN ords ON ords.rn = 1 + MOD(seq.n - 1, ords.cnt)
JOIN prods ON prods.rn = 1 + MOD(seq.n - 1, prods.cnt)
WHERE seq.n > (SELECT COUNT(*) FROM order_items);

INSERT INTO daily_kpi (stat_date, metric_code, metric_name, region_id, value)
WITH RECURSIVE seq AS (
  SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 600
),
regs AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn, COUNT(*) OVER () AS cnt
  FROM regions WHERE level = 1
)
SELECT
  DATE_ADD('2023-01-01', INTERVAL seq.n DAY),
  ELT(1 + MOD(seq.n - 1, 4), 'gmv', 'orders', 'users', 'nps'),
  ELT(1 + MOD(seq.n - 1, 4), '成交额', '订单数', '活跃用户', '满意度'),
  regs.id,
  ROUND(100 + (seq.n % 900) * 12.5, 2)
FROM seq
JOIN regs ON regs.rn = 1 + MOD(seq.n - 1, regs.cnt)
WHERE seq.n > (SELECT COUNT(*) FROM daily_kpi);

INSERT INTO dirty_orders (product_name, amount, status, note)
WITH RECURSIVE seq AS (
  SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 600
)
SELECT
  CONCAT('脏数据商品 ', seq.n),
  CAST(ROUND(10 + (seq.n % 500) * 3.2, 2) AS CHAR),
  ELT(1 + MOD(seq.n - 1, 3), 'ok', 'pending', 'bad'),
  CONCAT('etl-pad-', seq.n)
FROM seq
WHERE seq.n > (SELECT COUNT(*) FROM dirty_orders);

INSERT INTO map_flows (start_name, start_lng, start_lat, end_name, end_lng, end_lat, flow_amount, flow_date, channel)
WITH RECURSIVE seq AS (
  SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 600
),
geo AS (
  SELECT region_name, lng, lat, ROW_NUMBER() OVER (ORDER BY region_id) AS rn, COUNT(*) OVER () AS cnt
  FROM geo_locations WHERE level = 2
)
SELECT
  CONCAT('仓-', src.region_name),
  src.lng,
  src.lat,
  dst.region_name,
  dst.lng,
  dst.lat,
  ROUND(3000 + (seq.n % 200) * 80, 2),
  DATE_ADD('2025-01-01', INTERVAL MOD(seq.n, 180) DAY),
  ELT(1 + MOD(seq.n - 1, 3), '公路', '铁路', '航空')
FROM seq
JOIN geo src ON src.rn = 1 + MOD(seq.n - 1, src.cnt)
JOIN geo dst ON dst.rn = 1 + MOD(seq.n, dst.cnt)
WHERE seq.n > (SELECT COUNT(*) FROM map_flows);

INSERT INTO gov_service_metrics (stat_date, department, metric_code, metric_name, region_id, value)
WITH RECURSIVE seq AS (
  SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 600
),
regs AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn, COUNT(*) OVER () AS cnt
  FROM regions WHERE level = 1
)
SELECT
  DATE_ADD('2024-01-01', INTERVAL MOD(seq.n, 400) DAY),
  ELT(1 + MOD(seq.n - 1, 6), '市场监管局', '住建局', '卫健委', '教育局', '公安局', '政务服务中心'),
  ELT(1 + MOD(seq.n - 1, 4), 'satisfaction', 'cases_handled', 'online_rate', 'response_time'),
  ELT(1 + MOD(seq.n - 1, 4), '满意度(%)', '办件量', '网办率(%)', '平均响应(小时)'),
  regs.id,
  ROUND(60 + (seq.n % 40) + (seq.n % 7) * 0.3, 2)
FROM seq
JOIN regs ON regs.rn = 1 + MOD(seq.n - 1, regs.cnt)
WHERE seq.n > (SELECT COUNT(*) FROM gov_service_metrics);

INSERT INTO gov_budget_items (fiscal_year, category, budget_amount, spent_amount)
WITH RECURSIVE seq AS (
  SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 600
)
SELECT
  2010 + MOD(seq.n, 16),
  CONCAT(ELT(1 + MOD(seq.n - 1, 6), '教育支出', '医疗卫生', '社会保障', '公共安全', '城乡社区', '交通运输'), '-', seq.n),
  ROUND(20000000 + (seq.n % 80) * 1000000, 2),
  ROUND(12000000 + (seq.n % 70) * 800000, 2)
FROM seq
WHERE seq.n > (SELECT COUNT(*) FROM gov_budget_items);

INSERT INTO gov_incidents (report_date, incident_type, severity, region_id, status, count)
WITH RECURSIVE seq AS (
  SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 600
),
regs AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn, COUNT(*) OVER () AS cnt
  FROM regions WHERE level = 1
)
SELECT
  DATE_ADD('2024-01-01', INTERVAL MOD(seq.n, 500) DAY),
  ELT(1 + MOD(seq.n - 1, 5), '自然灾害', '安全生产', '公共卫生', '交通拥堵', '舆情预警'),
  ELT(1 + MOD(seq.n - 1, 3), 'high', 'medium', 'low'),
  regs.id,
  ELT(1 + MOD(seq.n - 1, 3), 'resolved', 'handling', 'open'),
  1 + MOD(seq.n, 20)
FROM seq
JOIN regs ON regs.rn = 1 + MOD(seq.n - 1, regs.cnt)
WHERE seq.n > (SELECT COUNT(*) FROM gov_incidents);

INSERT INTO gov_grid_stats (grid_name, district, event_count, resolved_count, pending_count)
WITH RECURSIVE seq AS (
  SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 600
)
SELECT
  CONCAT(ELT(1 + MOD(seq.n - 1, 8), '城东', '城西', '城南', '城北', '高新', '滨江', '大学城', '产业园'), '网格-', LPAD(seq.n, 3, '0')),
  ELT(1 + MOD(seq.n - 1, 8), '天河区', '越秀区', '海珠区', '白云区', '黄埔区', '荔湾区', '番禺区', '南山区'),
  40 + MOD(seq.n * 7, 180),
  30 + MOD(seq.n * 5, 160),
  2 + MOD(seq.n, 20)
FROM seq
WHERE seq.n > (SELECT COUNT(*) FROM gov_grid_stats);

INSERT INTO gov_investment (report_date, industry, region_id, investment_amount, project_count)
WITH RECURSIVE seq AS (
  SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 600
),
regs AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn, COUNT(*) OVER () AS cnt
  FROM regions WHERE level = 1
)
SELECT
  DATE_ADD('2024-01-01', INTERVAL MOD(seq.n, 400) DAY),
  ELT(1 + MOD(seq.n - 1, 5), '新一代信息技术', '高端装备制造', '生物医药', '绿色能源', '现代服务业'),
  regs.id,
  ROUND(20000000 + (seq.n % 100) * 1500000, 2),
  1 + MOD(seq.n, 15)
FROM seq
JOIN regs ON regs.rn = 1 + MOD(seq.n - 1, regs.cnt)
WHERE seq.n > (SELECT COUNT(*) FROM gov_investment);

INSERT INTO gov_eco_monitor (monitor_date, monitor_point, index_code, index_name, region_id, index_value)
WITH RECURSIVE seq AS (
  SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 600
),
regs AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn, COUNT(*) OVER () AS cnt
  FROM regions WHERE level = 1
)
SELECT
  DATE_ADD('2024-01-01', INTERVAL MOD(seq.n, 400) DAY),
  CONCAT(ELT(1 + MOD(seq.n - 1, 4), '城北监测站', '城南监测站', '饮用水源地', '工业园区站'), '-', seq.n),
  ELT(1 + MOD(seq.n - 1, 2), 'aqi', 'water'),
  ELT(1 + MOD(seq.n - 1, 2), '空气质量指数', '水质达标率(%)'),
  regs.id,
  ROUND(50 + (seq.n % 50) + (seq.n % 9) * 0.2, 2)
FROM seq
JOIN regs ON regs.rn = 1 + MOD(seq.n - 1, regs.cnt)
WHERE seq.n > (SELECT COUNT(*) FROM gov_eco_monitor);

INSERT INTO gov_hotwords (word, weight, category)
WITH RECURSIVE seq AS (
  SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 600
)
SELECT
  CONCAT(ELT(1 + MOD(seq.n - 1, 10), '城管', '交通', '环保', '应急', '公安', '水务', '住建', '市场监管', '卫健', '消防'), '-', seq.n),
  20 + MOD(seq.n * 13, 80),
  ELT(1 + MOD(seq.n - 1, 2), 'department', 'topic')
FROM seq
WHERE seq.n > (SELECT COUNT(*) FROM gov_hotwords);

INSERT INTO gov_issues (seq, issue_type, location, unit, found_at, status, progress)
WITH RECURSIVE seq AS (
  SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 600
)
SELECT
  seq.n,
  ELT(1 + MOD(seq.n - 1, 6), '市容秩序', '交通拥堵', '噪声扰民', '积水内涝', '设施损坏', '食品安全'),
  CONCAT('演示地点 ', seq.n),
  ELT(1 + MOD(seq.n - 1, 6), '城管局', '交警支队', '生态环境局', '水务集团', '市政养护', '市场监管局'),
  DATE_SUB(NOW(), INTERVAL MOD(seq.n, 90) DAY),
  ELT(1 + MOD(seq.n - 1, 5), '整改中', '已派单', '待复核', '已完成', '已闭环'),
  CONCAT(10 + MOD(seq.n * 11, 90), '%')
FROM seq
WHERE seq.n > (SELECT COUNT(*) FROM gov_issues);

INSERT INTO gov_alerts (alert_time, location, content, status, sort_order)
WITH RECURSIVE seq AS (
  SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 600
)
SELECT
  CONCAT(LPAD(MOD(seq.n, 24), 2, '0'), ':', LPAD(MOD(seq.n * 7, 60), 2, '0')),
  CONCAT('演示点位 ', seq.n),
  CONCAT('演示告警内容 ', seq.n),
  ELT(1 + MOD(seq.n - 1, 4), 'warning', 'info', 'critical', 'resolved'),
  seq.n
FROM seq
WHERE seq.n > (SELECT COUNT(*) FROM gov_alerts);
