"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCREEN_CLOCK_MARKER = void 0;
exports.buildScreenTitleBar = buildScreenTitleBar;
exports.buildScreenClock = buildScreenClock;
exports.buildInsightTextPlaceholder = buildInsightTextPlaceholder;
exports.resolveShellAccent = resolveShellAccent;
exports.buildDataScreenShellWidgets = buildDataScreenShellWidgets;
const crypto_1 = require("crypto");
exports.SCREEN_CLOCK_MARKER = "__vs_screen_clock__";
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function buildScreenTitleBar(title, accent, order, canvasWidth = 1920) {
    return {
        id: (0, crypto_1.randomUUID)(),
        type: "text",
        title: "数据大屏标题",
        x: 0,
        y: 0,
        width: canvasWidth,
        height: 88,
        order,
        textConfig: {
            content: `<p style="text-align:center;margin:0;padding-top:18px"><span style="font-size:36px;font-weight:600;color:#e2e8f0">${escapeHtml(title)}</span></p>`,
            variant: "html",
            screenStyle: {
                titleBar: { accentColor: accent, variant: "de-trapezoid-wing", palette: "cobalt" },
            },
        },
    };
}
function buildScreenClock(order, canvasWidth = 1920) {
    return {
        id: (0, crypto_1.randomUUID)(),
        type: "text",
        title: "时钟",
        x: canvasWidth - 240,
        y: 8,
        width: 220,
        height: 72,
        order,
        textConfig: {
            content: exports.SCREEN_CLOCK_MARKER,
            variant: "plain",
            screenStyle: {
                clock: { color: "#94a3b8", fontSize: 14, showWeekday: true, showSeconds: true },
            },
        },
    };
}
function buildInsightTextPlaceholder(slot, order) {
    return {
        id: (0, crypto_1.randomUUID)(),
        type: "text",
        title: slot.title,
        x: slot.x,
        y: slot.y,
        width: slot.width,
        height: slot.height,
        order,
        textConfig: {
            content: '<p style="padding:16px 20px;margin:0;color:#94a3b8;font-size:13px;line-height:1.6">'
                + "AI 洞察区：workflow ② publish 组件后，compose 时传入 <code>artifact_ids</code> 替换本占位；"
                + "或于 5173 右栏改为 customViz。</p>",
            variant: "html",
        },
    };
}
function resolveShellAccent(styleConfig) {
    const widgetStyle = styleConfig.widgetStyle;
    const border = widgetStyle?.borderColor ?? "";
    const m = /^#([0-9a-fA-F]{6})/.exec(border);
    return m ? `#${m[1]}` : "#22d3ee";
}
function buildDataScreenShellWidgets(tpl, shell, startOrder) {
    const accent = shell?.accent ?? resolveShellAccent(tpl.styleConfig);
    const title = shell?.title?.trim() || tpl.name;
    const widgets = [
        buildScreenTitleBar(title, accent, startOrder, tpl.canvas.width),
    ];
    if (shell?.clock !== false) {
        widgets.push(buildScreenClock(startOrder + 1, tpl.canvas.width));
    }
    return widgets;
}
