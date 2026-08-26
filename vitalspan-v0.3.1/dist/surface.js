"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SURFACE_LABELS = void 0;
exports.normalizeSurfaceKind = normalizeSurfaceKind;
exports.getSurfacePreset = getSurfacePreset;
exports.buildEditUrl = buildEditUrl;
exports.fetchDashboardSurfaceKind = fetchDashboardSurfaceKind;
const shared_1 = require("./shared");
exports.SURFACE_LABELS = {
    dashboard: "仪表板",
    "data-screen": "数据大屏",
};
const DASHBOARD_CANVAS = { width: 1440, height: 1080 };
const DATA_SCREEN_CANVAS = { width: 1920, height: 1080 };
function normalizeSurfaceKind(raw) {
    const v = raw?.trim().toLowerCase();
    if (v === "dashboard" || v === "仪表板" || v === "看板") {
        return "dashboard";
    }
    if (v === "data-screen" || v === "datascreen" || v === "screen" || v === "大屏" || v === "数据大屏") {
        return "data-screen";
    }
    return null;
}
function getSurfacePreset(kind) {
    if (kind === "data-screen") {
        return {
            kind,
            canvas: { ...DATA_SCREEN_CANVAS },
            widgetWidth: 900,
            widgetHeight: 400,
            colWidth: 924,
            rowHeight: 444,
            styleConfig: {
                surfaceKind: "data-screen",
                colorScheme: "dark",
                scaleMode: "canvas",
                gapPreset: "md",
                widgetGap: 16,
                pixelGutter: 24,
                refreshIntervalSec: 60,
            },
        };
    }
    return {
        kind,
        canvas: { ...DASHBOARD_CANVAS },
        widgetWidth: 660,
        widgetHeight: 320,
        colWidth: 684,
        rowHeight: 364,
        styleConfig: {
            surfaceKind: "dashboard",
            colorScheme: "light",
            scaleMode: "canvas",
        },
    };
}
function buildEditUrl(feBase, dashboardId, kind) {
    const base = feBase.replace(/\/$/, "");
    const segment = kind === "data-screen" ? "data-screens" : "dashboards";
    return `${base}/${segment}/${dashboardId}/edit`;
}
function readSurfaceKindFromLayout(layout) {
    if (!layout || typeof layout !== "object") {
        return null;
    }
    const style = layout.styleConfig;
    return normalizeSurfaceKind((style?.surfaceKind ?? style?.surface_kind));
}
async function fetchDashboardSurfaceKind(cfg, token, dashboardId) {
    const data = await (0, shared_1.requestJson)("GET", `${cfg.apiBase}/dashboards/${dashboardId}`, undefined, token);
    const fromLayout = readSurfaceKindFromLayout(data.layoutJson);
    const kind = normalizeSurfaceKind(data.surfaceKind) ?? fromLayout ?? "dashboard";
    return { surfaceKind: kind, name: data.name ?? "" };
}
