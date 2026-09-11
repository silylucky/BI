-- VitalSpan BI 联调样例数据（Dashboard / SQL / 报表测试）

CREATE TABLE IF NOT EXISTS sales_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_date DATE NOT NULL,
  region VARCHAR(32) NOT NULL,
  product_category VARCHAR(64) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  status VARCHAR(16) NOT NULL DEFAULT 'completed'
);

INSERT INTO sales_orders (order_date, region, product_category, amount, quantity, status) VALUES
  ('2026-01-05', '华东', '办公用品', 1280.50, 12, 'completed'),
  ('2026-01-12', '华北', '电子设备', 5600.00, 2, 'completed'),
  ('2026-01-18', '华南', '办公用品', 890.00, 8, 'completed'),
  ('2026-02-03', '华东', '电子设备', 3200.00, 1, 'completed'),
  ('2026-02-14', '西南', '家具', 2100.00, 3, 'completed'),
  ('2026-02-20', '华北', '办公用品', 450.75, 5, 'completed'),
  ('2026-03-01', '华南', '电子设备', 8900.00, 4, 'completed'),
  ('2026-03-08', '华东', '家具', 1750.00, 2, 'completed'),
  ('2026-03-15', '西北', '办公用品', 320.00, 4, 'cancelled'),
  ('2026-03-22', '华北', '电子设备', 4100.00, 2, 'completed'),
  ('2026-04-02', '华东', '办公用品', 990.50, 10, 'completed'),
  ('2026-04-10', '华南', '家具', 2800.00, 1, 'completed'),
  ('2026-04-18', '西南', '电子设备', 1500.00, 1, 'pending'),
  ('2026-05-01', '华北', '办公用品', 670.00, 6, 'completed'),
  ('2026-05-12', '华东', '电子设备', 7200.00, 3, 'completed'),
  ('2026-05-20', '华南', '家具', 1950.00, 2, 'completed'),
  ('2026-06-03', '西北', '电子设备', 2300.00, 1, 'completed'),
  ('2026-06-15', '华东', '办公用品', 540.00, 7, 'completed'),
  ('2026-06-28', '华北', '家具', 3600.00, 2, 'completed'),
  ('2026-07-01', '华南', '电子设备', 5100.00, 2, 'completed');

CREATE OR REPLACE VIEW v_sales_by_region AS
SELECT region,
       COUNT(*) AS order_count,
       SUM(amount) AS total_amount,
       SUM(quantity) AS total_qty
FROM sales_orders
WHERE status = 'completed'
GROUP BY region;
