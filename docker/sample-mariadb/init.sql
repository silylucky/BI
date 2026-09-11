CREATE TABLE IF NOT EXISTS dirty_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_name VARCHAR(128) NOT NULL,
  amount VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  note VARCHAR(255) NULL
);

INSERT INTO dirty_orders (product_name, amount, status, note) VALUES
  ('Widget A', '12.5', 'active', NULL),
  ('Widget B', 'not-a-number', 'active', '脏金额'),
  ('Widget C', '99', 'deleted', '应过滤'),
  ('Widget D', '0', 'active', NULL),
  ('Widget E', '15.0', 'active', '正常备注');
