"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listLayoutTemplateCatalog = listLayoutTemplateCatalog;
exports.listLayoutTemplateIds = listLayoutTemplateIds;
exports.resolveLayoutTemplateId = resolveLayoutTemplateId;
exports.buildLayoutFromTemplate = buildLayoutFromTemplate;
exports.validateAllLayoutTemplates = validateAllLayoutTemplates;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const demoChartBinding_1 = require("./demoChartBinding");
const shared_1 = require("./shared");
const screenShell_1 = require("./screenShell");
const slotChartStyle_1 = require("./slotChartStyle");
function templatesDir() {
    return path_1.default.join((0, shared_1.pluginRootDir)(), "assets", "layout-templates");
}
function loadTemplateFile(id) {
    const file = path_1.default.join(templatesDir(), `${id}.json`);
    if (!(0, fs_1.existsSync)(file)) {
        throw new Error(`unknown layout template: ${id}`);
    }
    return JSON.parse((0, fs_1.readFileSync)(file, "utf-8"));
}
function listLayoutTemplateCatalog() {
    const indexPath = path_1.default.join(templatesDir(), "index.json");
    if (!(0, fs_1.existsSync)(indexPath)) {
        return [];
    }
    const index = JSON.parse((0, fs_1.readFileSync)(indexPath, "utf-8"));
    return index.templates ?? [];
}
function listLayoutTemplateIds() {
    const dir = templatesDir();
    if (!(0, fs_1.existsSync)(dir)) {
        return [];
    }
    return (0, fs_1.readdirSync)(dir)
        .filter((name) => name.endsWith(".json") && name !== "index.json")
        .map((name) => name.replace(/\.json$/, ""))
        .sort();
}
function resolveLayoutTemplateId(raw) {
    const v = raw?.trim().toLowerCase();
    if (!v) {
        return null;
    }
    const ids = listLayoutTemplateIds();
    if (ids.includes(v)) {
        return v;
    }
    const byName = listLayoutTemplateCatalog().find((item) => item.name.toLowerCase() === v || item.id === v);
    return byName?.id ?? null;
}
function resolveChartTypeForSlot(slot, chartTypes, index) {
    return chartTypes[index]?.trim() || slot.defaultChartType || "bar";
}
function buildChartWidgetFromSlot(slot, chartType, order) {
    const id = (0, crypto_1.randomUUID)();
    const type = chartType.trim() || slot.defaultChartType || "bar";
    const chartConfig = (0, slotChartStyle_1.applySlotAwareChartStyle)((0, demoChartBinding_1.buildDemoChartConfig)(type, id, "default", slot.title), slot);
    return {
        id,
        type: "chart",
        title: slot.title,
        x: slot.x,
        y: slot.y,
        width: slot.width,
        height: slot.height,
        order,
        chartConfig,
    };
}
function buildCustomVizWidgetFromSlot(slot, artifactId, order) {
    return {
        id: (0, crypto_1.randomUUID)(),
        type: "customViz",
        title: slot.title,
        x: slot.x,
        y: slot.y,
        width: slot.width,
        height: slot.height,
        order,
        customVizConfig: {
            artifactId: artifactId.trim(),
            dataBinding: { status: "manual" },
        },
    };
}
function buildLayoutFromTemplate(templateId, chartTypes, artifactIds, expectedSurface) {
    const tpl = loadTemplateFile(templateId);
    if (expectedSurface && tpl.surfaceKind !== expectedSurface) {
        throw new Error(`template ${templateId} is ${tpl.surfaceKind}, target is ${expectedSurface}; run vitalspan_list_layout_templates`);
    }
    const chartSlots = tpl.slots.filter((s) => s.type === "chart");
    const cvSlots = tpl.slots.filter((s) => s.type === "customViz");
    const notes = [];
    const widgets = [];
    let order = 0;
    const useShell = tpl.surfaceKind === "data-screen" && tpl.shell !== false;
    if (useShell) {
        const shellWidgets = (0, screenShell_1.buildDataScreenShellWidgets)(tpl, tpl.shell === false ? undefined : tpl.shell, order);
        widgets.push(...shellWidgets);
        order += shellWidgets.length;
        notes.push("data-screen shell: title bar + clock (DE-style)");
    }
    for (let i = 0; i < chartSlots.length; i++) {
        const chartType = resolveChartTypeForSlot(chartSlots[i], chartTypes, i);
        widgets.push(buildChartWidgetFromSlot(chartSlots[i], chartType, order++));
    }
    if (chartTypes.length > chartSlots.length) {
        notes.push(`truncated ${chartTypes.length - chartSlots.length} extra chart_types (template has ${chartSlots.length} chart slots)`);
    }
    for (let i = 0; i < cvSlots.length; i++) {
        const artifactId = artifactIds[i]?.trim();
        if (artifactId) {
            widgets.push(buildCustomVizWidgetFromSlot(cvSlots[i], artifactId, order++));
        }
        else {
            widgets.push((0, screenShell_1.buildInsightTextPlaceholder)(cvSlots[i], order++));
            notes.push(`customViz "${cvSlots[i].title}" → text placeholder (pass artifact_ids to replace)`);
        }
    }
    if (artifactIds.length > cvSlots.length) {
        notes.push(`truncated ${artifactIds.length - cvSlots.length} extra artifact_ids (template has ${cvSlots.length} customViz slots)`);
    }
    const layout = {
        version: 2,
        canvas: { ...tpl.canvas },
        widgets,
        globalFilters: [],
        styleConfig: { ...tpl.styleConfig },
    };
    assertTemplateLayoutWithinCanvas(layout, templateId);
    return { layout, notes };
}
function assertTemplateLayoutWithinCanvas(layout, templateId) {
    const canvas = layout.canvas;
    const widgets = layout.widgets;
    for (const widget of widgets) {
        const x = Number(widget.x);
        const y = Number(widget.y);
        const w = Number(widget.width);
        const h = Number(widget.height);
        if (x + w > canvas.width || y + h > canvas.height) {
            throw new Error(`layout template ${templateId} slot "${String(widget.title)}" exceeds canvas ${canvas.width}×${canvas.height}`);
        }
    }
}
function validateAllLayoutTemplates() {
    const errors = [];
    for (const id of listLayoutTemplateIds()) {
        try {
            const tpl = loadTemplateFile(id);
            assertTemplateLayoutWithinCanvas({
                canvas: tpl.canvas,
                widgets: tpl.slots.map((s, i) => ({
                    title: s.title,
                    x: s.x,
                    y: s.y,
                    width: s.width,
                    height: s.height,
                    order: i,
                })),
            }, id);
        }
        catch (e) {
            errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    return errors;
}
