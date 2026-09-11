export type EtlColumnMeta = {
  name: string;
  dataType?: string;
};

export type EtlRuleDraft = {
  type: string;
  [key: string]: string;
};

const NUMERIC_FLOAT_NAME =
  /(?:^|_)(amount|price|qty|quantity|total|cost|rate|weight|budget|spent|revenue|salary|fee|value|score|metric|measure|percent|ratio|balance|lat|lng|lon|latitude|longitude)(?:$|_)/i;
const NUMERIC_INT_NAME = /(?:^|_)(id|year|month|day|age|rank|seq|index|count|num|no)(?:$|_)/i;
const RENAME_SUFFIX = /^([a-z][a-z0-9_]*)_(name|title|label|desc|description)$/i;
const FILL_NULL_NAME =
  /(?:^|_)(note|notes|comment|comments|remark|remarks|memo)(?:$|_)/i;
const BOOLEAN_NAME = /^(is_|has_|can_|should_|enabled|active|deleted|visible|valid)/i;
const FILL_NULL_DEFAULT = "无备注";
const SKIP_RENAME_BASES = new Set(["id", "uuid", "guid", "pk", "key", "code", "type", "status"]);

function isStringLikeDataType(dataType: string | undefined): boolean {
  const dt = (dataType ?? "").toLowerCase();
  if (!dt) return true;
  return /char|text|json|blob|string|enum|set/.test(dt);
}

function suggestRenameTarget(name: string, columnNames: Set<string>): string | null {
  const match = name.match(RENAME_SUFFIX);
  if (!match) return null;
  const target = match[1].toLowerCase();
  if (target === name.toLowerCase() || SKIP_RENAME_BASES.has(target)) return null;
  if (columnNames.has(target) && target !== name.toLowerCase()) return null;
  return match[1];
}

/** 扫描全部源列，为每一列生成可落地的清洗规则。 */
export function suggestEtlRulesFromColumns(columns: EtlColumnMeta[]): EtlRuleDraft[] {
  const rules: EtlRuleDraft[] = [];
  const seen = new Set<string>();
  const columnNames = new Set(
    columns.map((col) => col.name.trim().toLowerCase()).filter(Boolean),
  );
  const renameTargets = new Set<string>();
  const renamedColumns = new Set<string>();

  for (const col of columns) {
    const name = col.name.trim();
    if (!name) continue;

    const renameTarget = suggestRenameTarget(name, columnNames);
    if (renameTarget) {
      const targetKey = renameTarget.toLowerCase();
      const key = `rename:${name}`;
      if (!seen.has(key) && !renameTargets.has(targetKey)) {
        seen.add(key);
        renameTargets.add(targetKey);
        renamedColumns.add(name.toLowerCase());
        rules.push({ type: "rename_column", from: name, to: renameTarget });
      }
    }

    if (FILL_NULL_NAME.test(name)) {
      const key = `fill:${name}`;
      if (!seen.has(key)) {
        seen.add(key);
        rules.push({ type: "fill_null", column: name, value: FILL_NULL_DEFAULT });
      }
    }

    if (renamedColumns.has(name.toLowerCase())) continue;

    if (!isStringLikeDataType(col.dataType)) continue;

    let castTarget: "float" | "integer" | "boolean" | null = null;
    if (BOOLEAN_NAME.test(name)) castTarget = "boolean";
    else if (NUMERIC_INT_NAME.test(name)) castTarget = "integer";
    else if (NUMERIC_FLOAT_NAME.test(name)) castTarget = "float";
    if (castTarget) {
      const key = `cast:${name}`;
      if (!seen.has(key)) {
        seen.add(key);
        rules.push({ type: "cast_type", column: name, to: castTarget });
      }
    }
  }

  if (columns.some((col) => col.name.trim().toLowerCase() === "status")) {
    rules.push({ type: "filter_rows", column: "status", op: "ne", value: "deleted" });
  }

  return rules;
}

export function summarizeEtlRules(rules: EtlRuleDraft[]): string {
  if (rules.length === 0) return "无额外规则（同步时默认自动清洗）";
  const parts: string[] = [];
  for (const rule of rules) {
    if (rule.type === "rename_column" && rule.from && rule.to) {
      parts.push(`${rule.from}→${rule.to}`);
    } else if (rule.type === "cast_type" && rule.column && rule.to) {
      parts.push(`${rule.column}→${rule.to}`);
    } else if (rule.type === "fill_null" && rule.column) {
      parts.push(`${rule.column} 填「${rule.value ?? ""}」`);
    } else if (rule.type === "filter_rows" && rule.column) {
      parts.push(`过滤 ${rule.column} ${rule.op ?? "ne"} ${rule.value ?? ""}`.trim());
    }
  }
  if (parts.length > 0) return parts.join("、");
  return `${rules.length} 条规则`;
}
