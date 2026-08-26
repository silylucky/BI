"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applySlotAwareChartStyle = applySlotAwareChartStyle;
function readDeStyle(chartConfig) {
    const nativeBody = chartConfig.nativeBody;
    return { ...(nativeBody?.deStyle ?? {}) };
}
function mergeDeStyle(chartConfig, patch) {
    const nativeBody = chartConfig.nativeBody ?? {};
    const prev = readDeStyle(chartConfig);
    return {
        ...chartConfig,
        nativeBody: {
            ...nativeBody,
            deStyle: { ...prev, ...patch },
        },
    };
}
function patchNested(deStyle, key, patch) {
    return {
        ...deStyle,
        [key]: { ...(deStyle[key] ?? {}), ...patch },
    };
}
function slotSpan(slot) {
    return Math.min(slot.width, slot.height);
}
/** 模板槽位 → 内置图 deStyle：避免壳层标题重复、矮槽裁切、关系图越界 */
function applySlotAwareChartStyle(chartConfig, slot) {
    const chartType = String(chartConfig.chartType ?? slot.defaultChartType ?? "");
    const h = slot.height;
    const w = slot.width;
    const span = slotSpan(slot);
    let deStyle = readDeStyle(chartConfig);
    // 大屏 shape 顶栏已显示 widget.title，禁止图表内再占标题带
    deStyle = patchNested(deStyle, "title", { show: false });
    if (chartType === "kpi" || chartType === "gauge" || chartType === "liquid") {
        const titleReserve = h <= 132 ? 22 : h <= 156 ? 28 : 36;
        const contentH = Math.max(48, h - titleReserve - 16);
        const fontSize = Math.max(24, Math.min(44, Math.round(contentH * 0.58)));
        if (h <= 132) {
            deStyle = patchNested(deStyle, "title", { show: false, fontSize: 11 });
        }
        else {
            deStyle = patchNested(deStyle, "title", { show: false, fontSize: h <= 156 ? 12 : 13 });
        }
        deStyle = patchNested(deStyle, chartType === "kpi" ? "kpi" : chartType, {
            fontSize,
            align: "center",
        });
        return mergeDeStyle(chartConfig, deStyle);
    }
    const compact = span < 360 || h < 280;
    if (compact) {
        deStyle = patchNested(deStyle, "legend", { show: false });
    }
    if (h < 200) {
        deStyle = patchNested(deStyle, "label", { show: false });
        return mergeDeStyle(chartConfig, deStyle);
    }
    if (h < 240) {
        deStyle = patchNested(deStyle, "legend", { show: false });
        deStyle = patchNested(deStyle, "label", { show: false });
    }
    if (chartType === "graph") {
        const graphBlock = { ...(deStyle.graph ?? {}) };
        delete graphBlock.repulsion;
        delete graphBlock.edgeLength;
        deStyle = { ...deStyle, graph: graphBlock };
        deStyle = patchNested(deStyle, "label", { show: span >= 280 });
    }
    if (chartType === "radar" && compact) {
        deStyle = patchNested(deStyle, "radar", { radiusPercent: 50, showAxisName: span >= 300 });
    }
    if ((chartType === "pie-donut" || chartType === "pie" || chartType === "pie-rose") &&
        compact) {
        deStyle = patchNested(deStyle, "pie", { outerRadiusPercent: 72 });
        deStyle = patchNested(deStyle, "label", {
            show: true,
            position: "inside",
            showPercent: false,
            showDimension: true,
        });
    }
    if (chartType === "word-cloud" && compact) {
        deStyle = patchNested(deStyle, "label", { show: false });
    }
    return mergeDeStyle(chartConfig, deStyle);
}
