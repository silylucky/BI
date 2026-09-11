import type { DatasetTable } from "./types";

export function getPrimaryTable(tables: DatasetTable[]): DatasetTable | null {
  return tables[0] ?? null;
}

export function setPrimaryTable(name: string): DatasetTable[] {
  const trimmed = name.trim();
  return trimmed ? [{ name: trimmed }] : [];
}

/** 编辑加载时只保留主表（对标 DE 单表语义）。 */
export function loadPrimaryOnly(tables: DatasetTable[]): DatasetTable[] {
  const primary = getPrimaryTable(tables);
  return primary ? [{ name: primary.name, alias: primary.alias ?? null }] : [];
}

export function normalizeTablesSingle(tables: DatasetTable[]): DatasetTable[] {
  return loadPrimaryOnly(tables);
}
