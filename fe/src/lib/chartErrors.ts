import { localizeApiMessage } from "@/lib/apiError";

const CODE_MAP: Record<string, string> = {
  CHART_FIELD_REQUIREMENT: "字段数量不符合图表要求",
  CHART_INVALID_STYLE_VARIANT: "所选样式子类型对该图表无效",
  CHART_MISSING_SERIES: "折线图/柱状图需至少配置 1 个维度与 1 个指标",
  CHART_INVALID_TYPE: "图表类型无效或未注册",
  CHART_MISSING_DATASOURCE: "请先选择数据源",
  CHART_MISSING_SQL: "SQL 模式需填写查询语句",
  CHART_MISSING_TABLE: "表模式需选择 schema 与数据表",
  CHART_MISSING_MODE: "请选择数据绑定方式（SQL / 表 / Dataset）",
  CHART_MISSING_CONFIG_ID: "Dataset 模式需选择数据集配置",
  CHART_MISSING_NATIVE_BODY: "原生模式需填写 nativeBody 配置",
  CHART_BINDING_CONFLICT: "bindingId 与内联 SQL/数据源字段不能同时存在",
  CHART_SQL_NOT_READONLY: "SQL 须为只读查询（禁止 INSERT/UPDATE/DELETE 等）",
  CHART_INVALID_TIME_FIELD: "时间字段名须为合法标识符",
  CHART_MISSING_TIME_PRESET: "相对时间范围需选择预设区间",
  CHART_MISSING_TIME_BOUNDS: "绝对时间范围需填写起止日期",
  CHART_INVALID_TIME_BOUNDS: "时间范围的起始日期不能晚于结束日期",
  CHART_NATIVE_SQL_DISGUISE: "原生模式不允许同时填写 SQL",
  CHART_INVALID: "图表配置无效，请检查各字段",
};

const CHART_TYPE_ZH: Record<string, string> = {
  table: "表格",
  line: "折线图",
  bar: "柱状图",
  pie: "饼图",
  gauge: "仪表盘",
  map: "地图",
  heatmap: "热力图",
  kpi: "KPI 指标",
  timeline: "时间轴",
  sankey: "桑基图",
  funnel: "漏斗图",
  graph: "关系图",
};

const MESSAGE_PATTERNS: Array<{ test: RegExp; text: string }> = [
  { test: /Input should be 'sql'/i, text: "当前为 Dataset 模式，请切换到「高级 SQL」或清空 Dataset 绑定" },
  { test: /Input should be 'dataset'/i, text: "当前为 SQL 模式，请切换到 Dataset 或填写 SQL" },
  { test: /field required/i, text: "请补全必填字段" },
  { test: /Unsupported chartType/i, text: "图表类型无效或未注册" },
];

const FIELD_REQ_DIM =
  /^(\w+) requires (\d+)-(\d+) dimensions, got (\d+)\.?(.*)$/;
const FIELD_REQ_MET = /^(\w+) requires (\d+)-(\d+) metrics, got (\d+)\.?(.*)$/;

function mapLegacyFieldRequirement(message: string): string | null {
  const dimMatch = message.match(FIELD_REQ_DIM);
  if (dimMatch) {
    const [, type, min, max, got, note] = dimMatch;
    return buildFieldCountMessage(type, "维度", Number(min), Number(max), Number(got), note?.trim());
  }
  const metMatch = message.match(FIELD_REQ_MET);
  if (metMatch) {
    const [, type, min, max, got, note] = metMatch;
    return buildFieldCountMessage(type, "指标", Number(min), Number(max), Number(got), note?.trim());
  }
  return null;
}

function buildFieldCountMessage(
  chartType: string,
  kind: "维度" | "指标",
  min: number,
  max: number,
  got: number,
  note?: string,
): string {
  const name = CHART_TYPE_ZH[chartType] ?? chartType;
  let reason: string;
  let action: string;
  if (got > max) {
    reason = `当前配置了 ${got} 个${kind}，最多允许 ${max} 个`;
    action = `请移除多余的${kind}槽位中的字段`;
  } else if (got < min) {
    reason = `当前仅有 ${got} 个${kind}，至少需要 ${min} 个`;
    action = `请在「数据」页签向${kind}槽位拖入字段`;
  } else {
    reason = `需要 ${min}–${max} 个${kind}，当前有 ${got} 个`;
    action = `请调整${kind}字段数量`;
  }
  const hint = note ? `。${note}` : "";
  return `${name}：${reason}。${action}${hint}`;
}

/** 将后端校验码/原文映射为带原因说明的中文提示 */
export function mapChartConfigError(code: string, message?: string): string {
  if (message) {
    if (/[\u4e00-\u9fff]/.test(message)) {
      return message;
    }
    const legacy = mapLegacyFieldRequirement(message);
    if (legacy) return legacy;
    for (const { test, text } of MESSAGE_PATTERNS) {
      if (test.test(message)) return text;
    }
    if (/^Input should be /i.test(message)) {
      return "数据绑定方式与当前配置不一致，请检查 Dataset / SQL 切换";
    }
    if (message.includes("dimensions and metrics are required")) {
      return CODE_MAP.CHART_MISSING_SERIES;
    }
    if (message.includes("styleVariant") && message.includes("not valid")) {
      return "所选样式子类型对该图表无效，请在样式页签更换子类型";
    }
  }
  if (code && CODE_MAP[code]) {
    if (code === "CHART_FIELD_REQUIREMENT" && message) {
      const legacy = mapLegacyFieldRequirement(message);
      if (legacy) return legacy;
    }
    return CODE_MAP[code];
  }
  return localizeApiMessage(message ?? "") || "配置校验失败，请检查字段与样式";
}

/** 合并 fields 中的重复提示 */
export function formatChartFieldErrors(
  code: string,
  fields: ReadonlyArray<{ message: string }>,
): string {
  const msgs = fields.map((f) => mapChartConfigError(code, f.message));
  return [...new Set(msgs)].join("；");
}
