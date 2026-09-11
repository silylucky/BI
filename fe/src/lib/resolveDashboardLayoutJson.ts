import type { DashboardLayout } from "@/components/dashboard/layoutUtils";
import { ApiRequestError } from "@/lib/api";

export type DashboardLayoutPayload = {
  layoutJson?: DashboardLayout | null;
  layout_json?: DashboardLayout | null;
};

/** 兼容 API 返回 camelCase / snake_case 布局字段 */
export function resolveDashboardLayoutJson(
  detail: DashboardLayoutPayload,
): DashboardLayout {
  const layout = detail.layoutJson ?? detail.layout_json;
  if (!layout || typeof layout.version !== "number") {
    throw new ApiRequestError(
      "看板布局数据格式异常，请刷新后重试",
      "DASH_INVALID_LAYOUT",
    );
  }
  return layout;
}

export function normalizeDashboardDetail<T extends DashboardLayoutPayload>(
  detail: T,
): T & { layoutJson: DashboardLayout } {
  return { ...detail, layoutJson: resolveDashboardLayoutJson(detail) };
}
