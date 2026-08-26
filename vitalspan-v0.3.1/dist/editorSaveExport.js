"use strict";
/** editor-save 请求体导出：与 upload loadEditorSaveBody 对称 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEditorSaveLinkageFilters = isEditorSaveLinkageFilters;
exports.buildEditorSaveExport = buildEditorSaveExport;
/** editor-save 顶层的 globalFilters 为联动对象，不是 layout v2 内的数组 */
function isEditorSaveLinkageFilters(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    const obj = value;
    return typeof obj.dashboardId === "string" || typeof obj.dashboard_id === "string";
}
function buildEditorSaveExport(dashboard) {
    if (!dashboard.layoutJson || typeof dashboard.layoutJson !== "object") {
        throw new Error("GET /dashboards/{id} missing layoutJson");
    }
    const body = { layoutJson: dashboard.layoutJson };
    if (dashboard.name) {
        body.name = dashboard.name;
    }
    if (isEditorSaveLinkageFilters(dashboard.globalFilters)) {
        body.globalFilters = dashboard.globalFilters;
    }
    return body;
}
