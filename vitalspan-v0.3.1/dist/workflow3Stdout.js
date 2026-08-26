"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DASHBOARD_OK_RE = void 0;
exports.validateWorkflow3Stdout = validateWorkflow3Stdout;
const DASHBOARD_OK_RE = /ok\s+dashboardId=([0-9a-fA-F-]{36})/i;
exports.DASHBOARD_OK_RE = DASHBOARD_OK_RE;
const LAYOUT_WIDGETS_RE = /layout widgets:\s*(\d+)/i;
function validateWorkflow3Stdout(toolStdout) {
    const reasons = [];
    if (!toolStdout.trim()) {
        reasons.push("workflow 3 requires tool_stdout from vitalspan_compose_dashboard or vitalspan_upload_dashboard");
        return reasons;
    }
    if (!DASHBOARD_OK_RE.test(toolStdout)) {
        reasons.push("tool_stdout must contain ok dashboardId=<uuid> from compose or upload");
    }
    if (toolStdout.includes("next: vitalspan_upload_dashboard")) {
        reasons.push("tool_stdout from create_dashboard is not workflow 3 completion — compose or upload required");
    }
    if (toolStdout.includes("patch style only")) {
        reasons.push("tool_stdout from get_dashboard_layout is not completion — upload after style patch");
    }
    if (/\nfile \S+/.test(toolStdout)) {
        reasons.push("tool_stdout looks like get_dashboard_layout export — use compose or upload stdout");
    }
    const widgetMatch = LAYOUT_WIDGETS_RE.exec(toolStdout);
    if (!widgetMatch || Number(widgetMatch[1]) < 1) {
        reasons.push("tool_stdout must include layout widgets: N with N>=1 from compose or upload");
    }
    return reasons;
}
