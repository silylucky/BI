-- 官方演示覆盖层（vs_official_* · 全 chartType 验收夹具；幂等 CREATE OR REPLACE）

CREATE OR REPLACE VIEW vs_official_region_share AS
SELECT province AS region_name, SUM(amount) AS total_amount
FROM de_sales_wide GROUP BY province;

CREATE OR REPLACE VIEW vs_official_flow AS
SELECT '访问' AS flow_source, '注册' AS flow_target, 100 AS flow_weight
UNION ALL SELECT '注册', '付费', 40
UNION ALL SELECT '访问', '跳出', 60
UNION ALL SELECT '付费', '复购', 25;

CREATE OR REPLACE VIEW vs_official_order_detail AS
SELECT o.order_no AS order_no, c.name AS customer_name, o.order_date AS order_date,
       o.status AS order_status, o.total_amount AS order_amount, prov.name AS province_name
FROM orders o
JOIN customers c ON o.customer_id = c.id
JOIN regions dist ON o.region_id = dist.id AND dist.level = 3
JOIN regions city ON dist.parent_id = city.id
JOIN regions prov ON city.parent_id = prov.id;

CREATE OR REPLACE VIEW vs_official_matrix_heat AS
SELECT CASE day_of_week
    WHEN 1 THEN '周日' WHEN 2 THEN '周一' WHEN 3 THEN '周二' WHEN 4 THEN '周三'
    WHEN 5 THEN '周四' WHEN 6 THEN '周五' WHEN 7 THEN '周六'
  END AS x_dim, channel AS y_dim, SUM(amount) AS heat_value
FROM (
  SELECT DAYOFWEEK(sale_date) AS day_of_week, channel, amount FROM sales
) src
GROUP BY day_of_week, channel;

CREATE OR REPLACE VIEW vs_official_stock_ohlc AS
SELECT s.sale_date AS trade_date,
  CAST(SUBSTRING_INDEX(GROUP_CONCAT(s.amount ORDER BY s.id), ',', 1) AS DECIMAL(12, 2)) AS open_price,
  CAST(SUBSTRING_INDEX(GROUP_CONCAT(s.amount ORDER BY s.id DESC), ',', 1) AS DECIMAL(12, 2)) AS close_price,
  MIN(s.amount) AS low_price, MAX(s.amount) AS high_price
FROM sales s GROUP BY s.sale_date ORDER BY s.sale_date;

CREATE OR REPLACE VIEW vs_official_bullet AS
SELECT category AS bullet_category, spent_amount AS actual_value, budget_amount AS target_value
FROM gov_budget_items WHERE fiscal_year = YEAR(CURDATE());

CREATE OR REPLACE VIEW vs_official_scatter AS
SELECT p.name AS product_name, p.unit_price AS unit_price, SUM(s.quantity) AS sale_qty,
       pc.name AS category_name, AVG(s.amount) AS avg_amount
FROM sales s
JOIN products p ON s.product_id = p.id
JOIN product_categories pc ON p.category_id = pc.id
GROUP BY p.id, p.name, p.unit_price, pc.name;

CREATE OR REPLACE VIEW vs_official_funnel AS
SELECT '浏览' AS funnel_stage, 1000 AS stage_count
UNION ALL SELECT '加购', 420 UNION ALL SELECT '下单', 280
UNION ALL SELECT '支付', 210 UNION ALL SELECT '复购', 95;

CREATE OR REPLACE VIEW vs_official_graph_edges AS
SELECT '华东' AS graph_source, '华南' AS graph_target, 85 AS edge_weight
UNION ALL SELECT '华北', '华东', 62 UNION ALL SELECT '华南', '西南', 48
UNION ALL SELECT '华东', '华北', 55 UNION ALL SELECT '西南', '华南', 38
UNION ALL SELECT '华北', '西南', 29;

CREATE OR REPLACE VIEW vs_official_word AS
SELECT word AS word_text, weight AS word_weight FROM gov_hotwords ORDER BY weight DESC;

CREATE OR REPLACE VIEW vs_official_bidirectional AS
SELECT department AS dept_name,
  GREATEST(ROUND(AVG(value) - 85, 1), 0) AS positive_value,
  GREATEST(ROUND(85 - AVG(value), 1), 0) AS negative_value
FROM gov_service_metrics WHERE metric_code = 'satisfaction' GROUP BY department;

CREATE OR REPLACE VIEW vs_official_waterfall AS
SELECT category AS step_name, spent_amount AS step_value
FROM gov_budget_items WHERE fiscal_year = YEAR(CURDATE()) ORDER BY id;

CREATE OR REPLACE VIEW vs_official_progress AS
SELECT category AS progress_name, spent_amount AS actual_value, budget_amount AS target_value
FROM gov_budget_items WHERE fiscal_year = YEAR(CURDATE());

CREATE OR REPLACE VIEW vs_official_bar_range AS
SELECT province AS range_region, MIN(amount) AS range_min, MAX(amount) AS range_max
FROM de_sales_wide GROUP BY province;

CREATE OR REPLACE VIEW vs_official_category_tree AS
SELECT pc.name AS parent_category, p.name AS child_name, SUM(s.amount) AS tree_amount
FROM sales s
JOIN products p ON s.product_id = p.id
JOIN product_categories pc ON p.category_id = pc.id
GROUP BY pc.name, p.name;

CREATE OR REPLACE VIEW vs_official_gauge AS
SELECT ROUND(AVG(value), 1) AS gauge_value FROM daily_kpi WHERE metric_code = 'gmv';
