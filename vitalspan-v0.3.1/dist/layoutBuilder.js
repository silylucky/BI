"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMixedDashboardLayout = buildMixedDashboardLayout;
exports.buildEmptySurfaceLayout = buildEmptySurfaceLayout;
exports.normalizeWidgetIds = normalizeWidgetIds;
exports.alignLayoutToSurface = alignLayoutToSurface;
exports.assertLayoutWithinCanvas = assertLayoutWithinCanvas;
const crypto_1 = require("crypto");
const demoChartBinding_1 = require("./demoChartBinding");
const slotChartStyle_1 = require("./slotChartStyle");
const surface_1 = require("./surface");
const MARGIN = 48;
const GAP = 24;
const MIN_CELL_W = 240;
const MIN_CELL_H = 128;
const CHART_LABELS = {
    bar: "柱状图",
    line: "折线图",
    pie: "饼图",
    kpi: "指标卡",
    gauge: "仪表盘",
    table: "明细表",
    map: "区域地图",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function computeFitGrid(count, canvasWidth, canvasHeight) {
    const usableW = canvasWidth - 2 * MARGIN;
    const usableH = canvasHeight - 2 * MARGIN;
    let best = null;
    for (let cols = 1; cols <= Math.min(count, 4); cols++) {
        const rows = Math.ceil(count / cols);
        const cellW = Math.floor((usableW - (cols - 1) * GAP) / cols);
        const cellH = Math.floor((usableH - (rows - 1) * GAP) / rows);
        if (cellW < MIN_CELL_W || cellH < MIN_CELL_H) {
            continue;
        }
        if (!best || cellH > best.cellH || (cellH === best.cellH && cols > best.cols)) {
            best = { cols, rows, cellW, cellH };
        }
    }
    if (best) {
        return best;
    }
    const cols = Math.min(count, 2);
    const rows = Math.ceil(count / cols);
    return {
        cols,
        rows,
        cellW: Math.max(MIN_CELL_W, Math.floor((usableW - (cols - 1) * GAP) / cols)),
        cellH: Math.max(MIN_CELL_H, Math.floor((usableH - (rows - 1) * GAP) / rows)),
    };
}
function cellPosition(index, grid) {
    const col = index % grid.cols;
    const row = Math.floor(index / grid.cols);
    return {
        x: MARGIN + col * (grid.cellW + GAP),
        y: MARGIN + row * (grid.cellH + GAP),
    };
}
function chartWidgetTitle(chartType) {
    return (0, demoChartBinding_1.demoChartTitle)(chartType) ?? CHART_LABELS[chartType] ?? chartType;
}
function buildChartWidget(chartType, order, x, y, width, height) {
    const id = (0, crypto_1.randomUUID)();
    const trimmed = chartType.trim();
    const title = chartWidgetTitle(trimmed);
    const chartConfig = (0, slotChartStyle_1.applySlotAwareChartStyle)((0, demoChartBinding_1.buildDemoChartConfig)(trimmed, id, "default", title), { width, height, defaultChartType: trimmed });
    return {
        id,
        type: "chart",
        title,
        x,
        y,
        width,
        height,
        order,
        chartConfig,
    };
}
function buildMixedDashboardLayout(chartTypes, artifactIds, surfaceKind = "dashboard") {
    const preset = (0, surface_1.getSurfacePreset)(surfaceKind);
    const canvasWidth = preset.canvas.width;
    const total = chartTypes.length + artifactIds.length;
    const grid = computeFitGrid(total, canvasWidth, preset.canvas.height);
    const widgets = [];
    let order = 0;
    let index = 0;
    for (const chartType of chartTypes) {
        const { x, y } = cellPosition(index++, grid);
        widgets.push(buildChartWidget(chartType.trim(), order++, x, y, grid.cellW, grid.cellH));
    }
    for (const artifactId of artifactIds) {
        const { x, y } = cellPosition(index++, grid);
        widgets.push({
            id: (0, crypto_1.randomUUID)(),
            type: "customViz",
            title: "AI 组件",
            x,
            y,
            width: grid.cellW,
            height: grid.cellH,
            order: order++,
            customVizConfig: {
                artifactId: artifactId.trim(),
                dataBinding: { status: "manual" },
            },
        });
    }
    const canvasHeight = surfaceKind === "data-screen"
        ? preset.canvas.height
        : Math.max(preset.canvas.height, MARGIN + grid.rows * grid.cellH + (grid.rows - 1) * GAP + MARGIN);
    return {
        version: 2,
        canvas: { width: canvasWidth, height: canvasHeight },
        widgets,
        globalFilters: [],
        styleConfig: { ...preset.styleConfig },
    };
}
function buildEmptySurfaceLayout(surfaceKind) {
    const preset = (0, surface_1.getSurfacePreset)(surfaceKind);
    return {
        version: 2,
        canvas: { ...preset.canvas },
        widgets: [],
        globalFilters: [],
        styleConfig: { ...preset.styleConfig },
    };
}
/** Agent 手写 layout 时 id 常非 UUID；保存前自动修正。 */
function normalizeWidgetIds(layout) {
    const widgets = layout.widgets;
    if (!widgets?.length) {
        return 0;
    }
    let fixed = 0;
    for (const widget of widgets) {
        const id = String(widget.id ?? "");
        if (!UUID_RE.test(id)) {
            const newId = (0, crypto_1.randomUUID)();
            widget.id = newId;
            fixed += 1;
            const chartConfig = widget.chartConfig;
            if (chartConfig) {
                chartConfig.chartId = newId;
            }
            continue;
        }
        const chartConfig = widget.chartConfig;
        if (chartConfig?.chartId && !UUID_RE.test(String(chartConfig.chartId))) {
            chartConfig.chartId = id;
            fixed += 1;
        }
    }
    return fixed;
}
function alignLayoutToSurface(layout, surfaceKind) {
    const notes = [];
    const preset = (0, surface_1.getSurfacePreset)(surfaceKind);
    const style = layout.styleConfig ?? {};
    const oldKind = (0, surface_1.normalizeSurfaceKind)((style.surfaceKind ?? style.surface_kind));
    if (oldKind !== surfaceKind) {
        layout.styleConfig = { ...style, ...preset.styleConfig };
        notes.push(`surfaceKind ${oldKind ?? "missing"} -> ${surfaceKind}`);
    }
    const oldCanvas = layout.canvas;
    const oldW = oldCanvas?.width ?? preset.canvas.width;
    const oldH = oldCanvas?.height ?? preset.canvas.height;
    const targetW = preset.canvas.width;
    const widgets = layout.widgets ?? [];
    if (oldW !== targetW || (surfaceKind === "data-screen" && oldH !== preset.canvas.height)) {
        const targetH = surfaceKind === "data-screen" ? preset.canvas.height : oldH;
        const scaleX = targetW / oldW;
        const scaleY = targetH / oldH;
        for (const widget of widgets) {
            widget.x = Math.round(Number(widget.x ?? 0) * scaleX);
            widget.y = Math.round(Number(widget.y ?? 0) * scaleY);
            widget.width = Math.max(1, Math.round(Number(widget.width ?? 0) * scaleX));
            widget.height = Math.max(1, Math.round(Number(widget.height ?? 0) * scaleY));
        }
        if (surfaceKind === "data-screen") {
            layout.canvas = { width: targetW, height: preset.canvas.height };
        }
        else {
            const maxBottom = widgets.reduce((max, widget) => Math.max(max, Number(widget.y ?? 0) + Number(widget.height ?? 0)), 0);
            layout.canvas = {
                width: targetW,
                height: Math.max(preset.canvas.height, maxBottom + MARGIN),
            };
        }
        notes.push(`canvas ${oldW}×${oldH} scaled to ${targetW}×${layout.canvas.height}`);
    }
    else if (!oldCanvas) {
        layout.canvas = { ...preset.canvas };
        notes.push(`canvas set to ${targetW}×${preset.canvas.height}`);
    }
    return notes;
}
function assertLayoutWithinCanvas(layout) {
    const canvas = layout.canvas;
    const widgets = layout.widgets;
    if (!canvas?.width || !canvas?.height || !widgets?.length) {
        return;
    }
    for (const widget of widgets) {
        const x = Number(widget.x ?? 0);
        const y = Number(widget.y ?? 0);
        const width = Number(widget.width ?? 0);
        const height = Number(widget.height ?? 0);
        if (x + width > canvas.width || y + height > canvas.height) {
            throw new Error(`layout widget "${String(widget.title ?? widget.id)}" exceeds canvas ${canvas.width}×${canvas.height}; use vitalspan_compose_dashboard instead of hand-written JSON`);
        }
    }
}
