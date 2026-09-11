/** dirty_orders 演示 ETL 模板（与 backend/app/ingestion/etl_templates.py 对齐）。 */
export const DIRTY_ORDERS_DEMO_SOURCE_TABLE = "dirty_orders";

export const DIRTY_ORDERS_DEMO_ETL_RULES = [
  { type: "cast_type", column: "amount", to: "float" },
  { type: "filter_rows", column: "status", op: "ne", value: "deleted" },
] as const;
