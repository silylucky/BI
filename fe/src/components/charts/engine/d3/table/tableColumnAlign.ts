const NUMERIC_FIELD =
  /^(amount|quantity|cnt|count|total|sum|avg|price|qty|num|value|rate|ratio|percent|score)$/i;
const DATE_FIELD = /date|time|_at$/i;

function isNumericValue(raw: unknown): boolean {
  if (raw == null || raw === "") return true;
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n);
}

/** 对标 DataEase：数值右对齐、序号/id 居中、文本左对齐 */
export function resolveColumnAlign(
  field: string,
  rows: unknown[][],
  colIndex: number,
): "left" | "right" | "center" {
  if (field === "__vs_series__") return "center";
  if (field === "id" || field.endsWith("_id")) return "center";

  const samples = rows.slice(0, 24).map((row) => (colIndex >= 0 ? row[colIndex] : undefined));
  const nonEmpty = samples.filter((v) => v != null && v !== "");
  const allNumeric = nonEmpty.length > 0 && nonEmpty.every(isNumericValue);

  if (allNumeric || NUMERIC_FIELD.test(field)) return "right";
  if (DATE_FIELD.test(field)) return "center";
  return "left";
}

export function columnAlignClass(align: "left" | "right" | "center"): string {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}
