/** Parse `schema.table` or bare `table` from Dataset table name. */
export function parseQualifiedTable(name: string): { schema: string; table: string } {
  const trimmed = name.trim();
  const dot = trimmed.indexOf(".");
  if (dot === -1) return { schema: "", table: trimmed };
  return { schema: trimmed.slice(0, dot), table: trimmed.slice(dot + 1) };
}

function normalizeSchemaPart(schema: string | undefined): string {
  return (schema?.trim() || "public").toLowerCase();
}

function normalizeTablePart(table: string): string {
  return table.trim().toLowerCase();
}

/** Compare dataset table name with bind payload schema/table (lenient). */
export function tablesMatchForBind(
  datasetTableName: string,
  boundSchema?: string,
  boundTable?: string,
): boolean {
  if (!datasetTableName.trim()) return false;
  if (!boundTable?.trim()) return true;

  const datasetParsed = parseQualifiedTable(datasetTableName);
  const boundParsed = boundTable.includes(".")
    ? parseQualifiedTable(boundTable)
    : {
        schema: boundSchema?.trim() || "",
        table: boundTable.trim(),
      };

  const tableMatches =
    normalizeTablePart(datasetParsed.table) === normalizeTablePart(boundParsed.table);
  if (!tableMatches) return false;

  // Dataset 仅存裸表名（如官方示例 v_sales_geo）时，绑定侧带 schema 仍视为同表。
  if (!datasetParsed.schema.trim()) return true;

  return (
    normalizeSchemaPart(datasetParsed.schema) ===
    normalizeSchemaPart(boundParsed.schema || boundSchema)
  );
}

/** 列元数据探针用：裸表名时优先用绑定配置里的 schema.table。 */
export function resolveMetadataTableName(
  datasetTableName: string,
  boundSchema?: string,
  boundTable?: string,
): string {
  const datasetParsed = parseQualifiedTable(datasetTableName);
  if (datasetParsed.schema.trim()) return datasetTableName;
  if (boundSchema?.trim() && boundTable?.trim()) {
    return `${boundSchema.trim()}.${boundTable.trim()}`;
  }
  return datasetTableName;
}
