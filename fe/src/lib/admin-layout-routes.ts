/** 分页列表页：main 区填满视口、禁止整页纵向滚动 */
const ADMIN_LIST_FILL_PATTERNS: RegExp[] = [
  /^\/admin\/dashboards\/?$/,
  /^\/admin\/data-screens\/?$/,
  /^\/admin\/agent\/?$/,
  /^\/admin\/viz-templates\/?$/,
  /^\/admin\/viz-components\/?$/,
  /^\/admin\/datasources\/?$/,
  /^\/admin\/datasets\/?$/,
  /^\/admin\/services\/?$/,
  /^\/admin\/governance\/catalog\/?$/,
  /^\/admin\/system\/audit\/?$/,
  /^\/admin\/system\/users\/?$/,
  /^\/admin\/system\/?$/,
  /^\/admin\/system\/roles\/?$/,
  /^\/admin\/system\/rls\/?$/,
  /^\/admin\/system\/orgs\/?$/,
  /^\/admin\/system\/grants\/?$/,
  /^\/admin\/ingestion\/sync-jobs\/?$/,
  /^\/admin\/reports\/standard\/results\/?$/,
  /^\/admin\/reports\/standard\/setup\/?$/,
  /^\/admin\/reports\/center\/?$/,
  /^\/admin\/reports\/schedules\/?$/,
  /^\/admin\/reports\/templates(?:\/[^/]+)?\/?$/,
];

const ADMIN_SCREEN_PREVIEW_PATTERN = /^\/admin\/data-screens\/[^/]+\/preview\/?$/;

const ADMIN_VIZ_COMPONENT_EDIT_PATTERN = /^\/admin\/viz-components\/[^/]+\/edit\/?$/;

/** Dataset 新建/编辑：全宽 + fill 高度（Schema 浏览器占满视口） */
const ADMIN_DATASET_FORM_PATTERN = /^\/admin\/datasets\/(?:new|[^/]+\/edit)\/?$/;

/** 数据源新建/编辑：全宽 + fill 高度（连接表单分区布局） */
const ADMIN_DATASOURCE_FORM_PATTERN = /^\/admin\/datasources\/(?:new|[^/]+\/edit)\/?$/;

/** 数据源详情：全宽 + fill 高度（元数据浏览占满剩余视口） */
const ADMIN_DATASOURCE_DETAIL_PATTERN = /^\/admin\/datasources\/(?!new$)[^/]+\/?$/;

/** 同步任务新建/编辑/清洗规则：全宽 + fill 高度（表单在壳内滚动） */
const ADMIN_SYNC_JOB_FORM_PATTERN =
  /^\/admin\/ingestion\/sync-jobs\/(?:new|[^/]+\/edit|[^/]+\/etl-rules)\/?$/;

/** 分享/嵌入配置页：全宽 fill（bi-share-embed） */
const ADMIN_SHARE_PATTERNS: RegExp[] = [
  /^\/admin\/dashboards\/[^/]+\/share\/?$/,
  /^\/admin\/data-screens\/[^/]+\/share\/?$/,
];

/**
 * 宽内容页：全宽但保留 main 纵向滚动（表格/主从/Hub/详情/设计器）。
 */
const ADMIN_WIDE_SCROLL_PATTERNS: RegExp[] = [
  /^\/admin\/reports(?:\/|$)/,
  /^\/admin\/governance\/tickets\/?$/,
  /^\/admin\/governance\/publish\/?$/,
  /^\/admin\/designer\/?$/,
  /^\/admin\/metadata(?:\/|$)/,
  /^\/admin\/themes\/[^/]+\/?$/,
  /^\/admin\/entities\/overview\/?$/,
  /^\/admin\/ingestion\/sync-jobs\/[^/]+\/history\/?$/,
];

/** 看板/大屏编辑与查看（由 AdminLayout useMatch 判定，此处供测试与文档） */
const ADMIN_DASHBOARD_BUILDER_PATTERN =
  /^\/admin\/(?:dashboards|data-screens)\/[^/]+(?:\/edit)?\/?$/;

export function isAdminShareRoute(pathname: string): boolean {
  return ADMIN_SHARE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function isAdminVizComponentEditRoute(pathname: string): boolean {
  return ADMIN_VIZ_COMPONENT_EDIT_PATTERN.test(pathname);
}

export function isAdminDatasetFormRoute(pathname: string): boolean {
  return ADMIN_DATASET_FORM_PATTERN.test(pathname);
}

export function isAdminDatasourceFormRoute(pathname: string): boolean {
  return ADMIN_DATASOURCE_FORM_PATTERN.test(pathname);
}

export function isAdminDatasourceDetailRoute(pathname: string): boolean {
  return ADMIN_DATASOURCE_DETAIL_PATTERN.test(pathname);
}

export function isAdminSyncJobFormRoute(pathname: string): boolean {
  return ADMIN_SYNC_JOB_FORM_PATTERN.test(pathname);
}

export function isAdminScreenPreviewRoute(pathname: string): boolean {
  return ADMIN_SCREEN_PREVIEW_PATTERN.test(pathname);
}

export function isAdminListFillRoute(pathname: string): boolean {
  return ADMIN_LIST_FILL_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function isAdminWideScrollRoute(pathname: string): boolean {
  // fill 路由优先：避免与 ADMIN_WIDE_SCROLL_PATTERNS 中 /admin/reports 前缀重叠
  if (isAdminListFillRoute(pathname)) return false;
  return ADMIN_WIDE_SCROLL_PATTERNS.some((pattern) => pattern.test(pathname));
}

/** 是否匹配看板/大屏 builder（edit 或 view）路由 */
export function isAdminDashboardBuilderRoute(pathname: string): boolean {
  return ADMIN_DASHBOARD_BUILDER_PATTERN.test(pathname);
}

/** main 区应使用 max-w-none（全宽）：所有 /admin 路由 */
export function isAdminMaxWidthNoneRoute(
  pathname: string,
  options?: { dashboardBuilder?: boolean },
): boolean {
  if (options?.dashboardBuilder) return true;
  return pathname.startsWith("/admin");
}

/** @deprecated 管理端已统一全宽；保留供审计，恒为 false */
export function isAdminConstrainedRoute(_pathname: string): boolean {
  return false;
}
