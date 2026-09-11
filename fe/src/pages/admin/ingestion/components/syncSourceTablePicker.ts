import { isSyncSourceCapable } from "@/lib/datasourceRoles";

const MANUAL_SOURCE_TABLE_TYPES = new Set(["rest_api", "csv", "excel"]);

const PG_SCHEMA_SOURCE_TYPES = new Set([
  "postgresql",
  "postgres",
  "timescaledb",
  "kingbase",
  "gaussdb",
  "redshift",
]);

/** 是否可从连接元数据拉取源表/集合/索引列表。 */
export function supportsSyncSourceTablePicker(sourceType: string | undefined): boolean {
  if (!sourceType) return false;
  return isSyncSourceCapable(sourceType) && !MANUAL_SOURCE_TABLE_TYPES.has(sourceType);
}

export function usesPostgresSchemaSemantics(sourceType: string | undefined): boolean {
  if (!sourceType) return false;
  return PG_SCHEMA_SOURCE_TYPES.has(sourceType);
}

export function resolveSyncSourceSchema(
  schemas: string[],
  preferredDatabase?: string,
  sourceType?: string,
): string {
  const db = preferredDatabase?.trim();
  if (usesPostgresSchemaSemantics(sourceType)) {
    if (db && schemas.includes(db)) return db;
    if (schemas.includes("public")) return "public";
    return schemas.find((name) => !name.startsWith("_timescaledb")) ?? schemas[0] ?? "public";
  }
  if (db && schemas.includes(db)) return db;
  return schemas[0] ?? db ?? "";
}
