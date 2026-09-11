CREATE DATABASE IF NOT EXISTS sample_db;

CREATE TABLE IF NOT EXISTS sample_db.dirty_orders (
  id UInt32,
  product_name String,
  amount String,
  status String,
  note Nullable(String)
) ENGINE = MergeTree
ORDER BY id;

INSERT INTO sample_db.dirty_orders (id, product_name, amount, status, note) VALUES
  (1, 'Widget A', '12.5', 'active', NULL),
  (2, 'Widget B', 'not-a-number', 'active', '脏金额'),
  (3, 'Widget C', '99', 'deleted', '应过滤'),
  (4, 'Widget D', '0', 'active', NULL),
  (5, 'Widget E', '15.0', 'active', '正常备注');
