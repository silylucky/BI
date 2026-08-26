/** editor-save 请求体导出：与 upload loadEditorSaveBody 对称 */
export interface DashboardExportSource {
    name?: string;
    layoutJson?: Record<string, unknown>;
    globalFilters?: unknown;
}
/** editor-save 顶层的 globalFilters 为联动对象，不是 layout v2 内的数组 */
export declare function isEditorSaveLinkageFilters(value: unknown): boolean;
export declare function buildEditorSaveExport(dashboard: DashboardExportSource): Record<string, unknown>;
