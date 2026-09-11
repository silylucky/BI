/** manifest 中文标签在错误编码上传后会变成「??」，此处兜底为平台默认文案。 */
export function sanitizeManifestLabel(label: string | undefined, fallback: string): string {
  const trimmed = label?.trim();
  if (!trimmed) return fallback;
  if (/^[\uFFFD?]+$/.test(trimmed)) return fallback;
  return trimmed;
}

export const CUSTOM_VIZ_DEFAULT_DIMENSION_LABEL = "维度";
export const CUSTOM_VIZ_DEFAULT_METRIC_LABEL = "指标";

/** 常见 styleSchema 属性键 → 中文（DeepTalk 未写 title 时平台默认） */
export const CUSTOM_VIZ_STYLE_PROPERTY_TITLES: Record<string, string> = {
  accentColor: "强调色",
  animationDuration: "动画时长",
  barHeight: "条高度",
  barLabelColor: "条目标签色",
  bronzeColor: "铜牌色",
  cornerRadius: "圆角",
  curveType: "曲线类型",
  dangerColor: "危险色",
  fillOpacity: "填充不透明度",
  fontSize: "字号",
  goldColor: "金牌色",
  labelSize: "标签字号",
  layoutMode: "排列方式",
  lineWidth: "线宽",
  maxVisible: "最大可见条数",
  opacity: "不透明度",
  ringThickness: "环厚度",
  scrollSpeed: "滚动速度",
  showArea: "显示面积填充",
  showDots: "显示数据点",
  showPercent: "显示百分比",
  showPodium: "显示领奖台",
  showValue: "显示数值",
  showValues: "显示数值",
  silverColor: "银牌色",
  trackColor: "轨道色",
  valuePrefix: "数值前缀",
  warnColor: "警告色",
};

/** 常见 enum 取值 → 中文 */
export const CUSTOM_VIZ_STYLE_ENUM_LABELS: Record<string, string> = {
  compact: "紧凑模式",
  horizontal: "标准横向",
  linear: "直线",
  smooth: "平滑曲线",
  vertical: "纵向",
};

const CJK_RE = /[\u4e00-\u9fff]/;

const CAMEL_TOKEN_LABELS: Record<string, string> = {
  accent: "强调",
  animation: "动画",
  area: "面积",
  bar: "条",
  bg: "背景",
  border: "边框",
  bronze: "铜牌",
  color: "颜色",
  corner: "圆角",
  count: "数量",
  curve: "曲线",
  danger: "危险",
  dot: "点",
  dots: "数据点",
  duration: "时长",
  fill: "填充",
  font: "字体",
  gap: "间距",
  gold: "金牌",
  grid: "网格",
  height: "高度",
  label: "标签",
  layout: "布局",
  legend: "图例",
  line: "线",
  max: "最大",
  min: "最小",
  mode: "模式",
  opacity: "不透明度",
  padding: "内边距",
  percent: "百分比",
  podium: "领奖台",
  prefix: "前缀",
  radius: "半径",
  ring: "环",
  scroll: "滚动",
  shadow: "阴影",
  show: "显示",
  silver: "银牌",
  size: "大小",
  speed: "速度",
  suffix: "后缀",
  thickness: "厚度",
  track: "轨道",
  type: "类型",
  value: "数值",
  values: "数值",
  visible: "可见",
  warn: "警告",
  width: "宽度",
};

function isLikelyChineseLabel(label: string): boolean {
  return CJK_RE.test(label);
}

function isEnglishIdentifier(label: string): boolean {
  return /^[a-z][a-zA-Z0-9]*$/.test(label);
}

function translateToken(token: string): string {
  const lower = token.toLowerCase();
  return CAMEL_TOKEN_LABELS[lower] ?? token;
}

/** 将 camelCase 键拆成可读中文（未知键兜底，避免 UI 裸露英文） */
export function humanizeStylePropertyKey(key: string): string {
  if (CUSTOM_VIZ_STYLE_PROPERTY_TITLES[key]) return CUSTOM_VIZ_STYLE_PROPERTY_TITLES[key];

  const showMatch = /^show([A-Z].*)$/.exec(key);
  if (showMatch) {
    const innerKey = showMatch[1].charAt(0).toLowerCase() + showMatch[1].slice(1);
    const inner = humanizeStylePropertyKey(innerKey);
    return inner.startsWith("显示") ? inner : `显示${inner}`;
  }

  const tokens = key.replace(/([A-Z])/g, " $1").trim().split(/\s+/);
  if (tokens.length === 0) return key;

  const parts = tokens.map(translateToken);
  if (parts.length >= 2 && parts[parts.length - 1] === "颜色") {
    return `${parts.slice(0, -1).join("")}色`;
  }
  return parts.join("");
}

export function defaultStylePropertyLabel(key: string): string {
  return CUSTOM_VIZ_STYLE_PROPERTY_TITLES[key] ?? humanizeStylePropertyKey(key);
}

/** 样式字段标签：manifest title 为中文时用 manifest，否则平台中文默认 */
export function resolveCustomVizStylePropertyLabel(key: string, title?: string): string {
  const trimmed = title?.trim();
  if (trimmed && isLikelyChineseLabel(trimmed) && !/^[\uFFFD?]+$/.test(trimmed)) {
    return trimmed;
  }
  if (trimmed && !isEnglishIdentifier(trimmed) && !/^[\uFFFD?]+$/.test(trimmed)) {
    return trimmed;
  }
  return defaultStylePropertyLabel(key);
}

/** enum 选项标签：优先 enumNames，其次平台字典，最后 humanize */
export function resolveCustomVizStyleEnumLabel(
  option: string,
  enumNames: string[] | undefined,
  index: number,
  propKey?: string,
): string {
  const named = enumNames?.[index]?.trim();
  if (named && isLikelyChineseLabel(named) && !/^[\uFFFD?]+$/.test(named)) {
    return named;
  }
  if (named && !isEnglishIdentifier(named) && !/^[\uFFFD?]+$/.test(named)) {
    return named;
  }

  const scopedKey = propKey ? `${propKey}.${option}` : option;
  if (CUSTOM_VIZ_STYLE_ENUM_LABELS[scopedKey]) return CUSTOM_VIZ_STYLE_ENUM_LABELS[scopedKey];
  if (CUSTOM_VIZ_STYLE_ENUM_LABELS[option]) return CUSTOM_VIZ_STYLE_ENUM_LABELS[option];

  return humanizeStylePropertyKey(option);
}
