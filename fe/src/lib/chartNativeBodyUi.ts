/** nativeBody 中不影响 Dataset 绑定就绪的展示/交互键（跳转/联动/条件样式等） */
export const CHART_NATIVE_BODY_UI_KEYS = [
  "deStyle",
  "deDisplay",
  "deTableStyle",
  "deFeatures",
  "gisProject",
] as const;

export function isChartNativeBodyUiKey(key: string): boolean {
  return (CHART_NATIVE_BODY_UI_KEYS as readonly string[]).includes(key);
}

function isManualNativeBodyDataBinding(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return (value as { status?: unknown }).status === "manual";
}

export function nativeBodyHasLegacySqlBinding(
  nativeBody: Record<string, unknown> | undefined | null,
): boolean {
  if (!nativeBody) return false;
  return Object.keys(nativeBody).some((key) => {
    if (isChartNativeBodyUiKey(key)) return false;
    // VS-AI / 混排 demo：`{ status: "manual" }` 仅占位，用户绑 Dataset 后仍应出图（PROTOCOL / AIVIZ-004）
    if (key === "dataBinding" && isManualNativeBodyDataBinding(nativeBody.dataBinding)) {
      return false;
    }
    return true;
  });
}

export function pickChartNativeBodyUi(
  nativeBody: Record<string, unknown> | undefined | null,
): Record<string, unknown> | undefined {
  if (!nativeBody) return undefined;
  const next: Record<string, unknown> = {};
  for (const key of CHART_NATIVE_BODY_UI_KEYS) {
    if (nativeBody[key] != null) next[key] = nativeBody[key];
  }
  return Object.keys(next).length ? next : undefined;
}
