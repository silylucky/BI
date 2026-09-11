import { STANDARD_RESULTS_PATH, STANDARD_SETUP_PATH, standardAnalysisPath } from "@/pages/admin/reports/standardRoutes";
import { reportTemplatePath } from "@/pages/admin/reports/components/reportTemplateUi";
import { resolveActiveNavPath } from "@/lib/nav-active";

export const REPORT_CENTER_NAV_PATH = "/admin/reports/center";

export const REPORT_CENTER_SUB_NAV_PATHS = [
  REPORT_CENTER_NAV_PATH,
  STANDARD_RESULTS_PATH,
  STANDARD_SETUP_PATH,
  "/admin/reports/templates",
  "/admin/reports/schedules",
] as const;

/** 侧栏「报表中心」单入口：任一报表子路由均高亮 */
export function isReportCenterNavActive(pathname: string): boolean {
  if (pathname.startsWith("/admin/reports/view")) return true;
  return REPORT_CENTER_SUB_NAV_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/** 页内 Tab 高亮路径 */
export function resolveReportCenterSubNavPath(pathname: string): string | null {
  if (pathname.startsWith("/admin/reports/view")) {
    return "/admin/reports/templates";
  }
  if (pathname.startsWith(STANDARD_SETUP_PATH)) {
    return STANDARD_RESULTS_PATH;
  }
  return resolveActiveNavPath(pathname, [...REPORT_CENTER_SUB_NAV_PATHS]);
}

export function isReportCenterNavGroup(subItems: { path: string }[] | undefined): boolean {
  return Boolean(subItems?.some((sub) => sub.path.startsWith("/admin/reports")));
}

export const DOC_TEMPLATE_SCHEDULE_HINT =
  "打开文档模板 → 右侧「调度」Tab 配置定时生成与投递。";

export const DOC_TEMPLATE_PRODUCT_LINE =
  "固定版式文档（Excel/PDF 套版填数），支持扩展配置、版本发布与定时投递。";

export const VISUAL_SCHEDULE_PRODUCT_LINE =
  "看板/大屏编辑页「定时推送」，生成可视化 PDF 定时报告（推荐主路径）。";

export const VIZ_VS_DOC_TEMPLATE_HINT =
  "看板/大屏组件模板在侧栏「可视化模板」；本页为文档套版（Excel/PDF 填数导出）。";

export function canRetryReportSchedules(caps: Iterable<string> | Set<string>): boolean {
  const set = caps instanceof Set ? caps : new Set(caps);
  const has = (required: string) => {
    if (set.has("*") || set.has(required)) return true;
    const prefix = required.split(":")[0];
    return set.has(`${prefix}:*`) || set.has(`${prefix}:manage`);
  };
  return has("report:manage") || has("dashboard:schedule");
}

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  template: "文档模板",
  standard: "标准分析",
  schedule: "调度任务",
  dashboard: "看板",
};

export function localizeCenterResourceType(resourceType: string): string {
  return RESOURCE_TYPE_LABELS[resourceType] ?? resourceType;
}

export function resolveCenterRecentHref(item: {
  resourceType: string;
  resourceId: string;
}): string {
  switch (item.resourceType) {
    case "template":
      return reportTemplatePath(item.resourceId);
    case "standard":
      return standardAnalysisPath(item.resourceId);
    case "schedule":
      return `/admin/reports/schedules?tab=all&expand=${encodeURIComponent(item.resourceId)}`;
    default:
      return "/admin/reports/center";
  }
}
