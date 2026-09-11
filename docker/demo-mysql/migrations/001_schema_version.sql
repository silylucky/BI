-- 官方演示包 schema 版本表（增量迁移登记）
CREATE TABLE IF NOT EXISTS vs_schema_migrations (
  version INT PRIMARY KEY,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
