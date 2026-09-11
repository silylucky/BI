-- VitalSpan 统一演示库表结构与种子数据（UTF-8）
-- 供 sample-mysql(3307)、BI mysql-practice(3306) 共用

SET NAMES utf8mb4;

DROP VIEW IF EXISTS v_gov_region_service;
DROP VIEW IF EXISTS vs_official_progress;
DROP VIEW IF EXISTS vs_official_waterfall;
DROP VIEW IF EXISTS vs_official_bidirectional;
DROP VIEW IF EXISTS vs_official_word;
DROP VIEW IF EXISTS vs_official_graph_edges;
DROP VIEW IF EXISTS vs_official_funnel;
DROP VIEW IF EXISTS vs_official_scatter;
DROP VIEW IF EXISTS vs_official_bullet;
DROP VIEW IF EXISTS vs_official_stock_ohlc;
DROP VIEW IF EXISTS vs_official_matrix_heat;
DROP VIEW IF EXISTS vs_official_order_detail;
DROP VIEW IF EXISTS vs_official_flow;
DROP VIEW IF EXISTS vs_official_region_share;
DROP VIEW IF EXISTS vs_official_bar_range;
DROP VIEW IF EXISTS vs_official_category_tree;
DROP VIEW IF EXISTS vs_official_gauge;
DROP VIEW IF EXISTS de_map_flow;
DROP VIEW IF EXISTS de_map_heat;
DROP VIEW IF EXISTS de_map_district;
DROP VIEW IF EXISTS de_map_city;
DROP VIEW IF EXISTS de_map_province;
DROP VIEW IF EXISTS de_sales_wide;
DROP VIEW IF EXISTS v_sales_geo;
DROP TABLE IF EXISTS gov_alerts;
DROP TABLE IF EXISTS gov_issues;
DROP TABLE IF EXISTS gov_hotwords;
DROP TABLE IF EXISTS gov_eco_monitor;
DROP TABLE IF EXISTS gov_investment;
DROP TABLE IF EXISTS gov_grid_stats;
DROP TABLE IF EXISTS gov_incidents;
DROP TABLE IF EXISTS gov_budget_items;
DROP TABLE IF EXISTS gov_service_metrics;
DROP TABLE IF EXISTS map_flows;
DROP TABLE IF EXISTS geo_locations;

DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS sales;
DROP TABLE IF EXISTS daily_kpi;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS product_categories;
DROP TABLE IF EXISTS regions;
DROP TABLE IF EXISTS dirty_orders;

CREATE TABLE IF NOT EXISTS regions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(16) NOT NULL UNIQUE,
  name VARCHAR(64) NOT NULL,
  parent_id INT NULL,
  level TINYINT NOT NULL DEFAULT 1,
  INDEX idx_regions_parent (parent_id)
);

CREATE TABLE IF NOT EXISTS product_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sku VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  category_id INT NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  cost_price DECIMAL(12, 2) NOT NULL,
  stock_qty INT NOT NULL DEFAULT 0,
  INDEX idx_products_category (category_id)
);

CREATE TABLE IF NOT EXISTS customers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(64) NOT NULL,
  region_id INT NOT NULL,
  tier VARCHAR(16) NOT NULL,
  register_date DATE NOT NULL,
  contact_phone VARCHAR(20) NULL,
  INDEX idx_customers_region (region_id),
  INDEX idx_customers_tier (tier)
);

CREATE TABLE IF NOT EXISTS employees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  emp_no VARCHAR(16) NOT NULL UNIQUE,
  name VARCHAR(64) NOT NULL,
  department VARCHAR(64) NOT NULL,
  region_id INT NOT NULL,
  hire_date DATE NOT NULL,
  salary DECIMAL(12, 2) NOT NULL,
  INDEX idx_employees_region (region_id),
  INDEX idx_employees_dept (department)
);

CREATE TABLE IF NOT EXISTS sales (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sale_date DATE NOT NULL,
  region_id INT NOT NULL,
  product_id INT NOT NULL,
  customer_id INT NULL,
  quantity INT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  channel VARCHAR(32) NOT NULL,
  INDEX idx_sales_date (sale_date),
  INDEX idx_sales_region (region_id),
  INDEX idx_sales_product (product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(32) NOT NULL UNIQUE,
  order_date DATE NOT NULL,
  customer_id INT NOT NULL,
  region_id INT NOT NULL,
  status VARCHAR(16) NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  salesperson_id INT NULL,
  INDEX idx_orders_date (order_date),
  INDEX idx_orders_status (status),
  INDEX idx_orders_customer (customer_id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL,
  INDEX idx_order_items_order (order_id)
);

CREATE TABLE IF NOT EXISTS daily_kpi (
  id INT PRIMARY KEY AUTO_INCREMENT,
  stat_date DATE NOT NULL,
  metric_code VARCHAR(32) NOT NULL,
  metric_name VARCHAR(64) NOT NULL,
  region_id INT NULL,
  value DECIMAL(16, 2) NOT NULL,
  UNIQUE KEY uk_daily_kpi (stat_date, metric_code, region_id),
  INDEX idx_daily_kpi_date (stat_date)
);

CREATE TABLE IF NOT EXISTS dirty_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_name VARCHAR(128) NOT NULL,
  amount VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  note VARCHAR(255) NULL
);

-- 重建后无需 TRUNCATE
-- regions：三级行政区划（省 level=1 → 市 level=2 → 区县 level=3），名称对齐离线地图 GeoJSON

INSERT INTO regions (id, code, name, parent_id, level) VALUES
  (5, 'GD', '广东省', NULL, 1),
  (6, 'JS', '江苏省', NULL, 1),
  (7, 'BJ', '北京市', NULL, 1),
  (8, 'SH', '上海市', NULL, 1),
  (9, 'SC', '四川省', NULL, 1),
  (10, 'ZJ', '浙江省', NULL, 1),
  (51, 'GZ', '广州市', 5, 2),
  (52, 'SZ', '深圳市', 5, 2),
  (61, 'NJ', '南京市', 6, 2),
  (71, 'BJ-CITY', '北京市', 7, 2),
  (81, 'SH-CITY', '上海市', 8, 2),
  (91, 'CD', '成都市', 9, 2),
  (101, 'HZ', '杭州市', 10, 2),
  (511, 'GZ-TH', '天河区', 51, 3),
  (512, 'GZ-YX', '越秀区', 51, 3),
  (521, 'SZ-NS', '南山区', 52, 3),
  (522, 'SZ-FT', '福田区', 52, 3),
  (611, 'NJ-GL', '鼓楼区', 61, 3),
  (612, 'NJ-XW', '玄武区', 61, 3),
  (711, 'BJ-CY', '朝阳区', 71, 3),
  (712, 'BJ-HD', '海淀区', 71, 3),
  (811, 'SH-PD', '浦东新区', 81, 3),
  (812, 'SH-XH', '徐汇区', 81, 3),
  (911, 'CD-WH', '武侯区', 91, 3),
  (912, 'CD-JN', '锦江区', 91, 3),
  (1011, 'HZ-XH', '西湖区', 101, 3),
  (1012, 'HZ-YH', '余杭区', 101, 3),
  (11, 'SD', '山东省', NULL, 1),
  (12, 'HA', '河南省', NULL, 1),
  (13, 'HB', '湖北省', NULL, 1),
  (14, 'HN', '湖南省', NULL, 1),
  (15, 'FJ', '福建省', NULL, 1),
  (16, 'AH', '安徽省', NULL, 1),
  (17, 'SN', '陕西省', NULL, 1),
  (18, 'CQ', '重庆市', NULL, 1),
  (19, 'TJ', '天津市', NULL, 1),
  (20, 'LN', '辽宁省', NULL, 1),
  (21, 'HE', '河北省', NULL, 1),
  (22, 'YN', '云南省', NULL, 1),
  (23, 'GZU', '贵州省', NULL, 1),
  (24, 'JX', '江西省', NULL, 1),
  (25, 'GX', '广西壮族自治区', NULL, 1),
  (26, 'SX', '山西省', NULL, 1),
  (27, 'JL', '吉林省', NULL, 1),
  (28, 'HL', '黑龙江省', NULL, 1),
  (29, 'GS', '甘肃省', NULL, 1),
  (30, 'HI', '海南省', NULL, 1),
  (111, 'SD-JN', '济南市', 11, 2),
  (121, 'HA-ZZ', '郑州市', 12, 2),
  (131, 'HB-WH', '武汉市', 13, 2),
  (141, 'HN-CS', '长沙市', 14, 2),
  (151, 'FJ-FZ', '福州市', 15, 2),
  (161, 'AH-HF', '合肥市', 16, 2),
  (171, 'SN-XA', '西安市', 17, 2),
  (181, 'CQ-CITY', '重庆市', 18, 2),
  (191, 'TJ-CITY', '天津市', 19, 2),
  (201, 'LN-SY', '沈阳市', 20, 2),
  (211, 'HE-SJZ', '石家庄市', 21, 2),
  (221, 'YN-KM', '昆明市', 22, 2),
  (231, 'GZU-GY', '贵阳市', 23, 2),
  (241, 'JX-NC', '南昌市', 24, 2),
  (251, 'GX-NN', '南宁市', 25, 2),
  (261, 'SX-TY', '太原市', 26, 2),
  (271, 'JL-CC', '长春市', 27, 2),
  (281, 'HL-HEB', '哈尔滨市', 28, 2),
  (291, 'GS-LZ', '兰州市', 29, 2),
  (301, 'HI-HK', '海口市', 30, 2),
  (1111, 'SD-JN-LX', '历下区', 111, 3),
  (1211, 'HA-ZZ-JS', '金水区', 121, 3),
  (1311, 'HB-WH-WC', '武昌区', 131, 3),
  (1411, 'HN-CS-FR', '芙蓉区', 141, 3),
  (1511, 'FJ-FZ-GL', '鼓楼区', 151, 3),
  (1611, 'AH-HF-BH', '包河区', 161, 3),
  (1711, 'SN-XA-YT', '雁塔区', 171, 3),
  (1811, 'CQ-YZ', '渝中区', 181, 3),
  (1911, 'TJ-HP', '和平区', 191, 3),
  (2011, 'LN-SY-HP', '和平区', 201, 3),
  (2111, 'HE-SJZ-CA', '长安区', 211, 3),
  (2211, 'YN-KM-WH', '五华区', 221, 3),
  (2311, 'GZU-GY-NM', '南明区', 231, 3),
  (2411, 'JX-NC-DH', '东湖区', 241, 3),
  (2511, 'GX-NN-QX', '青秀区', 251, 3),
  (2611, 'SX-TY-XD', '小店区', 261, 3),
  (2711, 'JL-CC-NG', '南关区', 271, 3),
  (2811, 'HL-HEB-NG', '南岗区', 281, 3),
  (2911, 'GS-LZ-CG', '城关区', 291, 3),
  (3011, 'HI-HK-LH', '龙华区', 301, 3);

INSERT INTO product_categories (id, name) VALUES
  (1, '电脑整机'),
  (2, '显示设备'),
  (3, '外设配件'),
  (4, '办公耗材');

INSERT INTO products (id, sku, name, category_id, unit_price, cost_price, stock_qty) VALUES
  (1, 'NB-001', '商务笔记本电脑', 1, 8999.00, 6200.00, 120),
  (2, 'NB-002', '轻薄笔记本电脑', 1, 7499.00, 5100.00, 85),
  (3, 'TB-001', '平板电脑', 1, 3299.00, 2400.00, 200),
  (4, 'MN-001', '27寸显示器', 2, 1599.00, 980.00, 150),
  (5, 'MN-002', '24寸显示器', 2, 1299.00, 820.00, 180),
  (6, 'KB-001', '机械键盘', 3, 459.00, 260.00, 320),
  (7, 'MS-001', '无线鼠标', 3, 199.00, 95.00, 500),
  (8, 'HS-001', '降噪耳机', 3, 599.00, 350.00, 260),
  (9, 'PP-001', 'A4打印纸(箱)', 4, 89.00, 52.00, 800),
  (10, 'INK-001', '墨盒套装', 4, 299.00, 180.00, 400);

INSERT INTO customers (id, code, name, region_id, tier, register_date, contact_phone) VALUES
  (1, 'C001', '张三', 811, 'VIP', '2024-03-12', '13800010001'),
  (2, 'C002', '李四', 711, '普通', '2024-05-20', '13800010002'),
  (3, 'C003', '王五', 521, '企业', '2024-01-08', '13800010003'),
  (4, 'C004', '赵六', 611, 'VIP', '2024-07-15', '13800010004'),
  (5, 'C005', '钱七', 911, '普通', '2024-09-02', '13800010005'),
  (6, 'C006', '孙八', 512, '企业', '2023-11-30', '13800010006'),
  (7, 'C007', '周九', 712, 'VIP', '2024-02-18', '13800010007'),
  (8, 'C008', '吴十', 522, '普通', '2024-06-25', '13800010008'),
  (9, 'C009', '郑十一', 1011, '企业', '2024-04-10', '13800010009'),
  (10, 'C010', '华东科技', 511, '企业', '2023-08-01', '021-88880001');

INSERT INTO employees (id, emp_no, name, department, region_id, hire_date, salary) VALUES
  (1, 'E1001', '陈销售', '销售一部', 5, '2022-04-01', 12000.00),
  (2, 'E1002', '林销售', '销售一部', 7, '2021-09-15', 11500.00),
  (3, 'E1003', '黄销售', '销售二部', 8, '2023-01-10', 10800.00),
  (4, 'E2001', '刘分析', '数据分析', 5, '2020-06-01', 15000.00),
  (5, 'E3001', '何运维', '技术支持', 9, '2019-11-20', 13000.00);

INSERT INTO sales (sale_date, region_id, product_id, customer_id, quantity, amount, channel) VALUES
  ('2025-01-05', 811, 1, 1, 1, 8999.00, '线下门店'),
  ('2025-01-08', 711, 5, 2, 2, 2598.00, '电商平台'),
  ('2025-01-12', 521, 6, 3, 5, 2295.00, '企业直销'),
  ('2025-01-14', 511, 4, 10, 2, 3198.00, '企业直销'),
  ('2025-01-16', 512, 7, 6, 8, 1592.00, '电商平台'),
  ('2025-02-03', 522, 7, 8, 10, 1990.00, '电商平台'),
  ('2025-02-15', 911, 1, 5, 1, 9499.00, '线下门店'),
  ('2025-02-20', 912, 6, 5, 3, 1377.00, '电话销售'),
  ('2025-03-01', 712, 8, 7, 3, 1797.00, '电话销售'),
  ('2025-03-10', 521, 4, 8, 4, 6396.00, '电商平台'),
  ('2025-03-22', 511, 3, 10, 6, 19794.00, '企业直销'),
  ('2025-04-05', 911, 6, 5, 2, 918.00, '线下门店'),
  ('2025-04-18', 611, 2, 4, 1, 7499.00, '企业直销'),
  ('2025-04-22', 612, 9, 9, 12, 1068.00, '企业直销'),
  ('2025-05-02', 1011, 9, 9, 20, 1780.00, '企业直销'),
  ('2025-05-20', 521, 10, 3, 8, 2392.00, '电话销售'),
  ('2025-06-08', 811, 4, 1, 2, 3198.00, '线下门店'),
  ('2025-06-25', 711, 1, 2, 1, 8999.00, '电商平台'),
  ('2025-07-01', 1012, 7, 9, 15, 2985.00, '电商平台'),
  ('2025-07-01', 911, 7, 5, 15, 2985.00, '电商平台'),
  ('2025-01-20', 1111, 2, NULL, 3, 22497.00, '企业直销'),
  ('2025-02-08', 1211, 4, NULL, 2, 3198.00, '电商平台'),
  ('2025-02-18', 1311, 1, NULL, 1, 8999.00, '线下门店'),
  ('2025-03-05', 1411, 3, NULL, 4, 13196.00, '电话销售'),
  ('2025-03-15', 1511, 5, NULL, 6, 7794.00, '电商平台'),
  ('2025-03-28', 1611, 8, NULL, 2, 1198.00, '线下门店'),
  ('2025-04-02', 1711, 2, NULL, 1, 7499.00, '企业直销'),
  ('2025-04-12', 1811, 6, NULL, 5, 2295.00, '电商平台'),
  ('2025-04-25', 1911, 7, NULL, 8, 1592.00, '电话销售'),
  ('2025-05-06', 2011, 4, NULL, 3, 4797.00, '企业直销'),
  ('2025-05-14', 2111, 9, NULL, 10, 890.00, '电商平台'),
  ('2025-05-22', 2211, 10, NULL, 4, 1196.00, '电话销售'),
  ('2025-06-01', 2311, 1, NULL, 2, 17998.00, '企业直销'),
  ('2025-06-10', 2411, 3, NULL, 1, 3299.00, '线下门店'),
  ('2025-06-18', 2511, 5, NULL, 3, 3897.00, '电商平台'),
  ('2025-06-22', 2611, 6, NULL, 6, 1377.00, '电话销售'),
  ('2025-06-28', 2711, 2, NULL, 2, 14998.00, '企业直销'),
  ('2025-07-05', 2811, 8, NULL, 4, 2396.00, '电商平台'),
  ('2025-07-08', 2911, 7, NULL, 7, 1393.00, '电话销售'),
  ('2025-07-12', 3011, 3, NULL, 2, 6598.00, '线下门店'),
  ('2025-07-15', 1111, 1, NULL, 1, 8999.00, '企业直销'),
  ('2025-07-16', 1311, 4, NULL, 5, 6396.00, '电商平台'),
  ('2025-07-17', 1711, 5, NULL, 3, 3897.00, '电话销售'),
  ('2025-07-18', 2311, 6, NULL, 8, 918.00, '线下门店');

INSERT INTO orders (id, order_no, order_date, customer_id, region_id, status, total_amount, salesperson_id) VALUES
  (1, 'ORD-202501-001', '2025-01-10', 1, 811, '已完成', 8999.00, 1),
  (2, 'ORD-202501-002', '2025-01-18', 2, 711, '已完成', 1698.00, 2),
  (3, 'ORD-202502-001', '2025-02-02', 3, 521, '已取消', 399.00, 3),
  (4, 'ORD-202502-002', '2025-02-20', 4, 611, '已完成', 9499.00, 1),
  (5, 'ORD-202503-001', '2025-03-05', 5, 911, '处理中', 599.00, 3),
  (6, 'ORD-202503-002', '2025-03-25', 6, 512, '已完成', 4898.00, 1),
  (7, 'ORD-202504-001', '2025-04-12', 7, 712, '已完成', 8799.00, 2),
  (8, 'ORD-202505-001', '2025-05-08', 8, 522, '待付款', 3299.00, 3),
  (9, 'ORD-202506-001', '2025-06-15', 9, 1011, '已完成', 2670.00, 2),
  (10, 'ORD-202507-001', '2025-07-02', 10, 511, '处理中', 19794.00, 1);

INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES
  (1, 1, 1, 8999.00, 8999.00),
  (2, 5, 1, 1299.00, 1299.00),
  (2, 7, 2, 199.00, 398.00),
  (3, 7, 2, 199.50, 399.00),
  (4, 1, 1, 9499.00, 9499.00),
  (5, 8, 1, 599.00, 599.00),
  (6, 4, 2, 1599.00, 3198.00),
  (6, 6, 4, 425.00, 1700.00),
  (7, 2, 1, 7499.00, 7499.00),
  (7, 8, 2, 650.00, 1300.00),
  (8, 3, 1, 3299.00, 3299.00),
  (9, 9, 10, 89.00, 890.00),
  (9, 10, 6, 296.67, 1780.00),
  (10, 3, 6, 3299.00, 19794.00);

INSERT INTO daily_kpi (stat_date, metric_code, metric_name, region_id, value) VALUES
  ('2025-07-01', 'gmv', '成交额', 5, 125000.00),
  ('2025-07-01', 'gmv', '成交额', 7, 98000.00),
  ('2025-07-01', 'gmv', '成交额', 8, 143500.00),
  ('2025-07-01', 'orders', '订单数', 5, 42),
  ('2025-07-01', 'orders', '订单数', 7, 35),
  ('2025-07-01', 'orders', '订单数', 8, 51),
  ('2025-07-02', 'gmv', '成交额', 5, 118600.00),
  ('2025-07-02', 'gmv', '成交额', 7, 102300.00),
  ('2025-07-02', 'gmv', '成交额', 8, 136800.00),
  ('2025-07-02', 'visitors', '访客数', NULL, 3200),
  ('2025-07-03', 'visitors', '访客数', NULL, 3450),
  ('2025-07-03', 'conversion', '转化率(%)', NULL, 3.25);

INSERT INTO dirty_orders (product_name, amount, status, note) VALUES
  ('Widget A', '12.5', 'active', NULL),
  ('Widget B', 'not-a-number', 'active', '脏金额'),
  ('Widget C', '99', 'deleted', '应过滤'),
  ('Widget D', '0', 'active', NULL),
  ('Widget E', '15.0', 'active', '正常备注');

-- 地图下钻：sales.region_id 指向区县（level=3），展开省/市/区县名称
CREATE OR REPLACE VIEW v_sales_geo AS
SELECT
  s.id,
  s.sale_date,
  s.product_id,
  s.customer_id,
  s.quantity,
  s.amount,
  s.channel,
  prov.name AS province,
  city.name AS city,
  dist.name AS district
FROM sales s
JOIN regions dist ON s.region_id = dist.id AND dist.level = 3
JOIN regions city ON dist.parent_id = city.id
JOIN regions prov ON city.parent_id = prov.id;

-- ---------------------------------------------------------------------------
-- DataEase 地图练习：经纬度锚点 + 各图层 SQL 视图
-- 名称对齐离线 GeoJSON（省/市/区县全称，如 广东省、广州市、天河区）
-- ---------------------------------------------------------------------------

CREATE TABLE geo_locations (
  region_id INT PRIMARY KEY,
  region_name VARCHAR(64) NOT NULL,
  level TINYINT NOT NULL,
  lng DECIMAL(10, 6) NOT NULL,
  lat DECIMAL(10, 6) NOT NULL,
  INDEX idx_geo_level (level)
);

INSERT INTO geo_locations (region_id, region_name, level, lng, lat) VALUES
  (5, '广东省', 1, 113.266530, 23.132191),
  (6, '江苏省', 1, 118.796877, 32.060255),
  (7, '北京市', 1, 116.407396, 39.904200),
  (8, '上海市', 1, 121.473701, 31.230416),
  (9, '四川省', 1, 104.066541, 30.572269),
  (10, '浙江省', 1, 120.153576, 30.287459),
  (11, '山东省', 1, 117.000923, 36.675807),
  (12, '河南省', 1, 113.665412, 34.757975),
  (13, '湖北省', 1, 114.298572, 30.584355),
  (14, '湖南省', 1, 112.982279, 28.194090),
  (15, '福建省', 1, 119.306239, 26.075302),
  (16, '安徽省', 1, 117.283042, 31.861190),
  (17, '陕西省', 1, 108.948024, 34.263161),
  (18, '重庆市', 1, 106.504962, 29.533155),
  (19, '天津市', 1, 117.190182, 39.125596),
  (20, '辽宁省', 1, 123.429096, 41.796767),
  (21, '河北省', 1, 114.502461, 38.045474),
  (22, '云南省', 1, 102.712251, 25.040609),
  (23, '贵州省', 1, 106.713478, 26.578343),
  (24, '江西省', 1, 115.892151, 28.676493),
  (25, '广西壮族自治区', 1, 108.320004, 22.824020),
  (26, '山西省', 1, 112.549248, 37.857014),
  (27, '吉林省', 1, 125.324500, 43.886841),
  (28, '黑龙江省', 1, 126.642464, 45.756967),
  (29, '甘肃省', 1, 103.823557, 36.058039),
  (30, '海南省', 1, 110.331190, 20.031971),
  (51, '广州市', 2, 113.264385, 23.129112),
  (52, '深圳市', 2, 114.057868, 22.543099),
  (61, '南京市', 2, 118.796877, 32.060255),
  (71, '北京市', 2, 116.407396, 39.904200),
  (81, '上海市', 2, 121.473701, 31.230416),
  (91, '成都市', 2, 104.066541, 30.572269),
  (101, '杭州市', 2, 120.155070, 30.274084),
  (111, '济南市', 2, 117.000923, 36.675807),
  (121, '郑州市', 2, 113.665412, 34.757975),
  (131, '武汉市', 2, 114.298572, 30.584355),
  (141, '长沙市', 2, 112.982279, 28.194090),
  (151, '福州市', 2, 119.306239, 26.075302),
  (161, '合肥市', 2, 117.283042, 31.861190),
  (171, '西安市', 2, 108.948024, 34.263161),
  (181, '重庆市', 2, 106.504962, 29.533155),
  (191, '天津市', 2, 117.190182, 39.125596),
  (201, '沈阳市', 2, 123.429096, 41.796767),
  (211, '石家庄市', 2, 114.502461, 38.045474),
  (221, '昆明市', 2, 102.712251, 25.040609),
  (231, '贵阳市', 2, 106.713478, 26.578343),
  (241, '南昌市', 2, 115.892151, 28.676493),
  (251, '南宁市', 2, 108.320004, 22.824020),
  (261, '太原市', 2, 112.549248, 37.857014),
  (271, '长春市', 2, 125.324500, 43.886841),
  (281, '哈尔滨市', 2, 126.642464, 45.756967),
  (291, '兰州市', 2, 103.823557, 36.058039),
  (301, '海口市', 2, 110.331190, 20.031971),
  (511, '天河区', 3, 113.361200, 23.124680),
  (512, '越秀区', 3, 113.266830, 23.128910),
  (521, '南山区', 3, 113.930290, 22.533320),
  (522, '福田区', 3, 114.055036, 22.521520),
  (611, '鼓楼区', 3, 118.769700, 32.066600),
  (612, '玄武区', 3, 118.797900, 32.048700),
  (711, '朝阳区', 3, 116.443400, 39.921500),
  (712, '海淀区', 3, 116.298300, 39.959300),
  (811, '浦东新区', 3, 121.544700, 31.222200),
  (812, '徐汇区', 3, 121.436500, 31.188300),
  (911, '武侯区', 3, 104.043000, 30.641700),
  (912, '锦江区', 3, 104.081000, 30.656100),
  (1011, '西湖区', 3, 120.130200, 30.259000),
  (1012, '余杭区', 3, 120.299400, 30.419200),
  (1111, '历下区', 3, 117.076000, 36.666400),
  (1211, '金水区', 3, 113.660300, 34.800400),
  (1311, '武昌区', 3, 114.316200, 30.554000),
  (1411, '芙蓉区', 3, 113.031600, 28.185400),
  (1511, '鼓楼区', 3, 119.303900, 26.082600),
  (1611, '包河区', 3, 117.310000, 31.793800),
  (1711, '雁塔区', 3, 108.926600, 34.213600),
  (1811, '渝中区', 3, 106.562900, 29.552800),
  (1911, '和平区', 3, 117.214500, 39.117200),
  (2011, '和平区', 3, 123.420400, 41.789900),
  (2111, '长安区', 3, 114.539100, 38.036300),
  (2211, '五华区', 3, 102.707860, 25.043470),
  (2311, '南明区', 3, 106.715300, 26.573300),
  (2411, '东湖区', 3, 115.899300, 28.685100),
  (2511, '青秀区', 3, 108.494700, 22.785800),
  (2611, '小店区', 3, 112.565500, 37.736000),
  (2711, '南关区', 3, 125.350400, 43.864100),
  (2811, '南岗区', 3, 126.668800, 45.760200),
  (2911, '城关区', 3, 103.825200, 36.057100),
  (3011, '龙华区', 3, 110.330800, 20.031000);

CREATE TABLE map_flows (
  id INT PRIMARY KEY AUTO_INCREMENT,
  start_name VARCHAR(64) NOT NULL,
  start_lng DECIMAL(10, 6) NOT NULL,
  start_lat DECIMAL(10, 6) NOT NULL,
  end_name VARCHAR(64) NOT NULL,
  end_lng DECIMAL(10, 6) NOT NULL,
  end_lat DECIMAL(10, 6) NOT NULL,
  flow_amount DECIMAL(12, 2) NOT NULL,
  flow_date DATE NOT NULL,
  channel VARCHAR(32) NOT NULL,
  INDEX idx_map_flows_date (flow_date)
);

INSERT INTO map_flows (start_name, start_lng, start_lat, end_name, end_lng, end_lat, flow_amount, flow_date, channel) VALUES
  ('华南仓-广州', 113.264385, 23.129112, '深圳市', 114.057868, 22.543099, 18500.00, '2025-07-01', '公路'),
  ('华南仓-广州', 113.264385, 23.129112, '南山区', 113.930290, 22.533320, 12200.00, '2025-07-01', '公路'),
  ('华南仓-广州', 113.264385, 23.129112, '福田区', 114.055036, 22.521520, 9800.00, '2025-07-02', '公路'),
  ('华东仓-上海', 121.473701, 31.230416, '杭州市', 120.155070, 30.274084, 15600.00, '2025-07-01', '铁路'),
  ('华东仓-上海', 121.473701, 31.230416, '南京市', 118.796877, 32.060255, 11200.00, '2025-07-02', '铁路'),
  ('华东仓-上海', 121.473701, 31.230416, '浦东新区', 121.544700, 31.222200, 22400.00, '2025-07-03', '公路'),
  ('华北仓-北京', 116.407396, 39.904200, '朝阳区', 116.443400, 39.921500, 18900.00, '2025-07-01', '公路'),
  ('华北仓-北京', 116.407396, 39.904200, '海淀区', 116.298300, 39.959300, 14300.00, '2025-07-02', '公路'),
  ('华北仓-北京', 116.407396, 39.904200, '天津市', 117.190182, 39.125596, 8700.00, '2025-07-03', '铁路'),
  ('西南仓-成都', 104.066541, 30.572269, '武侯区', 104.043000, 30.641700, 13400.00, '2025-07-01', '公路'),
  ('西南仓-成都', 104.066541, 30.572269, '锦江区', 104.081000, 30.656100, 9200.00, '2025-07-02', '公路'),
  ('西南仓-成都', 104.066541, 30.572269, '重庆市', 106.504962, 29.533155, 11800.00, '2025-07-03', '铁路'),
  ('华中仓-武汉', 114.298572, 30.584355, '长沙市', 112.982279, 28.194090, 7600.00, '2025-07-01', '铁路'),
  ('华中仓-武汉', 114.298572, 30.584355, '郑州市', 113.665412, 34.757975, 6900.00, '2025-07-02', '铁路'),
  ('华中仓-武汉', 114.298572, 30.584355, '武昌区', 114.316200, 30.554000, 10500.00, '2025-07-03', '公路');

-- 填色地图 / 气泡地图：省级
CREATE OR REPLACE VIEW de_map_province AS
SELECT
  prov.name AS region_map,
  prov.name AS province,
  SUM(s.amount) AS amount,
  SUM(s.quantity) AS quantity,
  COUNT(*) AS sale_count
FROM sales s
JOIN regions dist ON s.region_id = dist.id AND dist.level = 3
JOIN regions city ON dist.parent_id = city.id
JOIN regions prov ON city.parent_id = prov.id
GROUP BY prov.id, prov.name;

-- 填色地图下钻：市级（地区选省后，维度用 region_map）
CREATE OR REPLACE VIEW de_map_city AS
SELECT
  prov.name AS province,
  city.name AS region_map,
  SUM(s.amount) AS amount,
  SUM(s.quantity) AS quantity,
  COUNT(*) AS sale_count
FROM sales s
JOIN regions dist ON s.region_id = dist.id AND dist.level = 3
JOIN regions city ON dist.parent_id = city.id
JOIN regions prov ON city.parent_id = prov.id
GROUP BY prov.id, prov.name, city.id, city.name;

-- 填色地图下钻：区县级
CREATE OR REPLACE VIEW de_map_district AS
SELECT
  prov.name AS province,
  city.name AS city,
  dist.name AS region_map,
  SUM(s.amount) AS amount,
  SUM(s.quantity) AS quantity,
  COUNT(*) AS sale_count
FROM sales s
JOIN regions dist ON s.region_id = dist.id AND dist.level = 3
JOIN regions city ON dist.parent_id = city.id
JOIN regions prov ON city.parent_id = prov.id
GROUP BY prov.id, prov.name, city.id, city.name, dist.id, dist.name;

-- 热力地图 / 符号地图：区县坐标 + 销售额（字段类型须设为「地理位置」）
CREATE OR REPLACE VIEW de_map_heat AS
SELECT
  s.id AS sale_id,
  s.sale_date,
  s.channel,
  prov.name AS province,
  city.name AS city,
  dist.name AS point_name,
  gl.lng,
  gl.lat,
  s.amount,
  s.quantity
FROM sales s
JOIN regions dist ON s.region_id = dist.id AND dist.level = 3
JOIN regions city ON dist.parent_id = city.id
JOIN regions prov ON city.parent_id = prov.id
JOIN geo_locations gl ON gl.region_id = dist.id;

-- 流向地图：仓 → 目的地
CREATE OR REPLACE VIEW de_map_flow AS
SELECT
  id,
  flow_date,
  channel,
  start_name,
  start_lng,
  start_lat,
  end_name,
  end_lng,
  end_lat,
  flow_amount
FROM map_flows;

-- 销售全宽表（柱/线/饼 + 省级地图 region_map）
CREATE OR REPLACE VIEW de_sales_wide AS
SELECT
  s.id AS sale_id,
  s.sale_date,
  YEAR(s.sale_date) AS sale_year,
  MONTH(s.sale_date) AS sale_month,
  s.quantity,
  s.amount,
  s.channel,
  prov.name AS province,
  city.name AS city,
  dist.name AS district,
  prov.name AS region_map,
  p.sku AS product_sku,
  p.name AS product_name,
  pc.name AS category_name,
  c.name AS customer_name,
  c.tier AS customer_tier
FROM sales s
JOIN regions dist ON s.region_id = dist.id AND dist.level = 3
JOIN regions city ON dist.parent_id = city.id
JOIN regions prov ON city.parent_id = prov.id
JOIN products p ON s.product_id = p.id
JOIN product_categories pc ON p.category_id = pc.id
LEFT JOIN customers c ON s.customer_id = c.id;

-- ---------------------------------------------------------------------------
-- 政企模板演示数据（10 套内置模板 SQL 引用）
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS gov_service_metrics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  stat_date DATE NOT NULL,
  department VARCHAR(64) NOT NULL,
  metric_code VARCHAR(32) NOT NULL,
  metric_name VARCHAR(64) NOT NULL,
  region_id INT NULL,
  value DECIMAL(16, 2) NOT NULL,
  INDEX idx_gov_svc_date (stat_date),
  INDEX idx_gov_svc_dept (department),
  INDEX idx_gov_svc_code (metric_code)
);

CREATE TABLE IF NOT EXISTS gov_budget_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  fiscal_year INT NOT NULL,
  category VARCHAR(64) NOT NULL,
  budget_amount DECIMAL(16, 2) NOT NULL,
  spent_amount DECIMAL(16, 2) NOT NULL,
  INDEX idx_gov_budget_year (fiscal_year)
);

CREATE TABLE IF NOT EXISTS gov_incidents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  report_date DATE NOT NULL,
  incident_type VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  region_id INT NULL,
  status VARCHAR(16) NOT NULL,
  count INT NOT NULL DEFAULT 1,
  INDEX idx_gov_inc_date (report_date)
);

CREATE TABLE IF NOT EXISTS gov_grid_stats (
  id INT PRIMARY KEY AUTO_INCREMENT,
  grid_name VARCHAR(64) NOT NULL,
  district VARCHAR(64) NOT NULL,
  event_count INT NOT NULL,
  resolved_count INT NOT NULL,
  pending_count INT NOT NULL
);

CREATE TABLE IF NOT EXISTS gov_investment (
  id INT PRIMARY KEY AUTO_INCREMENT,
  report_date DATE NOT NULL,
  industry VARCHAR(64) NOT NULL,
  region_id INT NULL,
  investment_amount DECIMAL(16, 2) NOT NULL,
  project_count INT NOT NULL,
  INDEX idx_gov_inv_date (report_date)
);

CREATE TABLE IF NOT EXISTS gov_eco_monitor (
  id INT PRIMARY KEY AUTO_INCREMENT,
  monitor_date DATE NOT NULL,
  monitor_point VARCHAR(64) NOT NULL,
  index_code VARCHAR(32) NOT NULL,
  index_name VARCHAR(64) NOT NULL,
  index_value DECIMAL(10, 2) NOT NULL,
  region_id INT NULL,
  INDEX idx_gov_eco_date (monitor_date)
);

CREATE TABLE IF NOT EXISTS gov_hotwords (
  id INT PRIMARY KEY AUTO_INCREMENT,
  word VARCHAR(64) NOT NULL,
  weight INT NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'department'
);

CREATE TABLE IF NOT EXISTS gov_issues (
  id INT PRIMARY KEY AUTO_INCREMENT,
  seq INT NOT NULL,
  issue_type VARCHAR(64) NOT NULL,
  location VARCHAR(128) NOT NULL,
  unit VARCHAR(64) NOT NULL,
  found_at DATETIME NOT NULL,
  status VARCHAR(16) NOT NULL,
  progress VARCHAR(16) NOT NULL
);

CREATE TABLE IF NOT EXISTS gov_alerts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  alert_time VARCHAR(16) NOT NULL,
  location VARCHAR(128) NOT NULL,
  content VARCHAR(256) NOT NULL,
  status VARCHAR(16) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

INSERT INTO gov_service_metrics (stat_date, department, metric_code, metric_name, region_id, value)
SELECT DATE_SUB(CURDATE(), INTERVAL 0 DAY), '市场监管局', 'satisfaction', '满意度(%)', NULL, 92.50
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 1 DAY), '市场监管局', 'satisfaction', '满意度(%)', NULL, 93.10
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 2 DAY), '市场监管局', 'satisfaction', '满意度(%)', NULL, 92.80
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 3 DAY), '住建局', 'satisfaction', '满意度(%)', NULL, 88.30
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 4 DAY), '住建局', 'satisfaction', '满意度(%)', NULL, 89.00
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 5 DAY), '卫健委', 'satisfaction', '满意度(%)', NULL, 91.20
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 6 DAY), '卫健委', 'satisfaction', '满意度(%)', NULL, 91.80
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 7 DAY), '教育局', 'satisfaction', '满意度(%)', NULL, 89.80
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 8 DAY), '公安局', 'satisfaction', '满意度(%)', NULL, 87.60
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 9 DAY), '人社局', 'satisfaction', '满意度(%)', NULL, 90.10
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 0 DAY), '政务服务中心', 'cases_handled', '办件量', NULL, 1280
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 1 DAY), '政务服务中心', 'cases_handled', '办件量', NULL, 1356
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 2 DAY), '政务服务中心', 'cases_handled', '办件量', NULL, 1198
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 0 DAY), '政务服务中心', 'online_rate', '网办率(%)', NULL, 96.50
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 1 DAY), '政务服务中心', 'online_rate', '网办率(%)', NULL, 97.10
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 2 DAY), '政务服务中心', 'online_rate', '网办率(%)', NULL, 96.80
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 0 DAY), '政务服务中心', 'response_time', '平均响应(小时)', NULL, 4.20
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 5 DAY), '政务服务中心', 'response_time', '平均响应(小时)', NULL, 4.50
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 10 DAY), '市场监管局', 'satisfaction', '满意度(%)', NULL, 91.40
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 15 DAY), '住建局', 'satisfaction', '满意度(%)', NULL, 88.90
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 20 DAY), '卫健委', 'satisfaction', '满意度(%)', NULL, 90.60;

INSERT INTO gov_budget_items (fiscal_year, category, budget_amount, spent_amount)
SELECT YEAR(CURDATE()), '教育支出', 85000000.00, 52300000.00
UNION ALL SELECT YEAR(CURDATE()), '医疗卫生', 62000000.00, 41800000.00
UNION ALL SELECT YEAR(CURDATE()), '社会保障', 98000000.00, 67200000.00
UNION ALL SELECT YEAR(CURDATE()), '公共安全', 45000000.00, 28900000.00
UNION ALL SELECT YEAR(CURDATE()), '城乡社区', 38000000.00, 24100000.00
UNION ALL SELECT YEAR(CURDATE()), '交通运输', 72000000.00, 46500000.00;

INSERT INTO gov_incidents (report_date, incident_type, severity, region_id, status, count)
SELECT DATE_SUB(CURDATE(), INTERVAL 0 DAY), '自然灾害', 'high', 5, 'resolved', 2
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 0 DAY), '安全生产', 'medium', 7, 'handling', 5
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 1 DAY), '公共卫生', 'medium', 8, 'resolved', 3
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 1 DAY), '交通拥堵', 'low', 8, 'resolved', 12
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 2 DAY), '舆情预警', 'high', NULL, 'handling', 1
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 3 DAY), '安全生产', 'high', 10, 'handling', 2
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 4 DAY), '自然灾害', 'medium', 9, 'resolved', 1
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 5 DAY), '公共卫生', 'low', 7, 'resolved', 4;

INSERT INTO gov_grid_stats (grid_name, district, event_count, resolved_count, pending_count) VALUES
  ('城东第一网格', '天河区', 156, 142, 14),
  ('城东第二网格', '天河区', 128, 119, 9),
  ('城西综合网格', '越秀区', 98, 91, 7),
  ('南湖社区网格', '海珠区', 112, 105, 7),
  ('北苑服务网格', '白云区', 87, 80, 7),
  ('高新园区网格', '黄埔区', 134, 126, 8),
  ('滨江治理网格', '荔湾区', 76, 72, 4),
  ('大学城网格', '番禺区', 65, 61, 4);

INSERT INTO gov_investment (report_date, industry, region_id, investment_amount, project_count) VALUES
  ('2025-07-01', '新一代信息技术', 5, 125000000.00, 8),
  ('2025-07-01', '高端装备制造', 10, 98000000.00, 6),
  ('2025-07-01', '生物医药', 8, 76000000.00, 5),
  ('2025-07-01', '绿色能源', 7, 54000000.00, 4),
  ('2025-07-01', '现代服务业', 5, 112000000.00, 11),
  ('2025-07-02', '新一代信息技术', 5, 88000000.00, 5),
  ('2025-07-02', '高端装备制造', 6, 67000000.00, 3);

INSERT INTO gov_eco_monitor (monitor_date, monitor_point, index_code, index_name, region_id, index_value)
SELECT DATE_SUB(CURDATE(), INTERVAL 0 DAY), '城北监测站', 'aqi', '空气质量指数', 7, 68.00
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 0 DAY), '城南监测站', 'aqi', '空气质量指数', 8, 72.00
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 1 DAY), '饮用水源地', 'water', '水质达标率(%)', 5, 98.50
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 1 DAY), '工业园区站', 'aqi', '空气质量指数', 10, 81.00
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 2 DAY), '城北监测站', 'aqi', '空气质量指数', 7, 65.00
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 3 DAY), '城南监测站', 'aqi', '空气质量指数', 8, 70.00
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 4 DAY), '饮用水源地', 'water', '水质达标率(%)', 5, 98.80
UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 5 DAY), '城北监测站', 'aqi', '空气质量指数', 7, 62.00;

INSERT INTO gov_hotwords (word, weight, category) VALUES
  ('城管', 95, 'department'),
  ('交通', 88, 'department'),
  ('环保', 82, 'department'),
  ('应急', 76, 'department'),
  ('公安', 90, 'department'),
  ('水务', 68, 'department'),
  ('住建', 74, 'department'),
  ('市场监管', 62, 'department'),
  ('卫健', 58, 'department'),
  ('消防', 85, 'department');

INSERT INTO gov_issues (seq, issue_type, location, unit, found_at, status, progress) VALUES
  (1, '市容秩序', '解放路步行街', '城管局', DATE_SUB(NOW(), INTERVAL 2 DAY), '整改中', '60%'),
  (2, '交通拥堵', '二环高架东段', '交警支队', DATE_SUB(NOW(), INTERVAL 3 DAY), '已派单', '30%'),
  (3, '噪声扰民', '学府小区北侧', '生态环境局', DATE_SUB(NOW(), INTERVAL 4 DAY), '待复核', '80%'),
  (4, '积水内涝', '站前广场地下通道', '水务集团', DATE_SUB(NOW(), INTERVAL 5 DAY), '整改中', '45%'),
  (5, '设施损坏', '市民公园照明', '市政养护', DATE_SUB(NOW(), INTERVAL 6 DAY), '已完成', '100%'),
  (6, '食品安全', '农贸市场3号档口', '市场监管局', DATE_SUB(NOW(), INTERVAL 7 DAY), '已闭环', '100%');

INSERT INTO gov_alerts (alert_time, location, content, status, sort_order) VALUES
  ('14:32', '滨江大道', '占道施工未报备，影响晚高峰通行', 'warning', 1),
  ('14:18', '高新区', 'PM2.5 短时升高，已派巡检车复核', 'info', 2),
  ('13:56', '地铁2号线', '站台客流超限，已增派疏导人员', 'critical', 3),
  ('13:41', '南湖片区', '消防通道占用已清理完毕', 'resolved', 4),
  ('13:22', '政务中心', '窗口排队时长超15分钟预警', 'warning', 5),
  ('12:58', '长江大桥', '桥面风速监测正常，无限行', 'info', 6);

CREATE OR REPLACE VIEW v_gov_region_service AS
SELECT
  province,
  city,
  district,
  ROUND(SUM(amount) * 1.35, 2) AS service_volume
FROM v_sales_geo
GROUP BY province, city, district;

-- ---------------------------------------------------------------------------
-- 官方演示覆盖层（vs_official_* · 全 chartType 验收夹具）
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW vs_official_region_share AS
SELECT
  province AS region_name,
  SUM(amount) AS total_amount
FROM de_sales_wide
GROUP BY province;

CREATE OR REPLACE VIEW vs_official_flow AS
SELECT '访问' AS flow_source, '注册' AS flow_target, 100 AS flow_weight
UNION ALL SELECT '注册', '付费', 40
UNION ALL SELECT '访问', '跳出', 60
UNION ALL SELECT '付费', '复购', 25;

CREATE OR REPLACE VIEW vs_official_order_detail AS
SELECT
  o.order_no AS order_no,
  c.name AS customer_name,
  o.order_date AS order_date,
  o.status AS order_status,
  o.total_amount AS order_amount,
  prov.name AS province_name
FROM orders o
JOIN customers c ON o.customer_id = c.id
JOIN regions dist ON o.region_id = dist.id AND dist.level = 3
JOIN regions city ON dist.parent_id = city.id
JOIN regions prov ON city.parent_id = prov.id;

CREATE OR REPLACE VIEW vs_official_matrix_heat AS
SELECT
  CASE day_of_week
    WHEN 1 THEN '周日'
    WHEN 2 THEN '周一'
    WHEN 3 THEN '周二'
    WHEN 4 THEN '周三'
    WHEN 5 THEN '周四'
    WHEN 6 THEN '周五'
    WHEN 7 THEN '周六'
  END AS x_dim,
  channel AS y_dim,
  SUM(amount) AS heat_value
FROM (
  SELECT DAYOFWEEK(sale_date) AS day_of_week, channel, amount FROM sales
) src
GROUP BY day_of_week, channel;

CREATE OR REPLACE VIEW vs_official_stock_ohlc AS
SELECT
  s.sale_date AS trade_date,
  CAST(SUBSTRING_INDEX(GROUP_CONCAT(s.amount ORDER BY s.id), ',', 1) AS DECIMAL(12, 2)) AS open_price,
  CAST(SUBSTRING_INDEX(GROUP_CONCAT(s.amount ORDER BY s.id DESC), ',', 1) AS DECIMAL(12, 2)) AS close_price,
  MIN(s.amount) AS low_price,
  MAX(s.amount) AS high_price
FROM sales s
GROUP BY s.sale_date
ORDER BY s.sale_date;

CREATE OR REPLACE VIEW vs_official_bullet AS
SELECT
  category AS bullet_category,
  spent_amount AS actual_value,
  budget_amount AS target_value
FROM gov_budget_items
WHERE fiscal_year = YEAR(CURDATE());

CREATE OR REPLACE VIEW vs_official_scatter AS
SELECT
  p.name AS product_name,
  p.unit_price AS unit_price,
  SUM(s.quantity) AS sale_qty,
  pc.name AS category_name,
  AVG(s.amount) AS avg_amount
FROM sales s
JOIN products p ON s.product_id = p.id
JOIN product_categories pc ON p.category_id = pc.id
GROUP BY p.id, p.name, p.unit_price, pc.name;

CREATE OR REPLACE VIEW vs_official_funnel AS
SELECT '浏览' AS funnel_stage, 1000 AS stage_count
UNION ALL SELECT '加购', 420
UNION ALL SELECT '下单', 280
UNION ALL SELECT '支付', 210
UNION ALL SELECT '复购', 95;

CREATE OR REPLACE VIEW vs_official_graph_edges AS
SELECT '华东' AS graph_source, '华南' AS graph_target, 85 AS edge_weight
UNION ALL SELECT '华北', '华东', 62
UNION ALL SELECT '华南', '西南', 48
UNION ALL SELECT '华东', '华北', 55
UNION ALL SELECT '西南', '华南', 38
UNION ALL SELECT '华北', '西南', 29;

CREATE OR REPLACE VIEW vs_official_word AS
SELECT word AS word_text, weight AS word_weight
FROM gov_hotwords
ORDER BY weight DESC;

CREATE OR REPLACE VIEW vs_official_bidirectional AS
SELECT
  department AS dept_name,
  GREATEST(ROUND(AVG(value) - 85, 1), 0) AS positive_value,
  GREATEST(ROUND(85 - AVG(value), 1), 0) AS negative_value
FROM gov_service_metrics
WHERE metric_code = 'satisfaction'
GROUP BY department;

CREATE OR REPLACE VIEW vs_official_waterfall AS
SELECT
  category AS step_name,
  spent_amount AS step_value
FROM gov_budget_items
WHERE fiscal_year = YEAR(CURDATE())
ORDER BY id;

CREATE OR REPLACE VIEW vs_official_progress AS
SELECT
  category AS progress_name,
  spent_amount AS actual_value,
  budget_amount AS target_value
FROM gov_budget_items
WHERE fiscal_year = YEAR(CURDATE());

CREATE OR REPLACE VIEW vs_official_bar_range AS
SELECT
  province AS range_region,
  MIN(amount) AS range_min,
  MAX(amount) AS range_max
FROM de_sales_wide
GROUP BY province;

CREATE OR REPLACE VIEW vs_official_category_tree AS
SELECT
  pc.name AS parent_category,
  p.name AS child_name,
  SUM(s.amount) AS tree_amount
FROM sales s
JOIN products p ON s.product_id = p.id
JOIN product_categories pc ON p.category_id = pc.id
GROUP BY pc.name, p.name;

CREATE OR REPLACE VIEW vs_official_gauge AS
SELECT ROUND(AVG(value), 1) AS gauge_value
FROM daily_kpi
WHERE metric_code = 'gmv';
