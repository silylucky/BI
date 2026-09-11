/** 编辑态同时挂载与数据集 execute 共用上限，避免 6 路画图挤进 3 路 HTTP 无界排队 */
export const CHART_LOAD_MAX_CONCURRENCY = 6;

export const CHART_MOUNTING_WATCHDOG_MS = 15_000;

export const CHART_EXECUTE_RESULT_CACHE_MAX = 64;
