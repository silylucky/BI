"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveComposeLayout = resolveComposeLayout;
const layoutBuilder_1 = require("./layoutBuilder");
const layoutTemplates_1 = require("./layoutTemplates");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const shared_1 = require("./shared");
function resolveComposeLayout(chartTypes, artifactIds, surfaceKind, templateRaw) {
    const templateId = (0, layoutTemplates_1.resolveLayoutTemplateId)(templateRaw);
    if (templateId) {
        const filledCharts = chartTypes.length
            ? chartTypes
            : defaultChartTypesForTemplate(templateId);
        const { layout, notes } = (0, layoutTemplates_1.buildLayoutFromTemplate)(templateId, filledCharts, artifactIds, surfaceKind);
        return { layout, notes, templateId };
    }
    if (templateRaw?.trim()) {
        throw new Error(`unknown layout template: ${templateRaw}; run vitalspan_list_layout_templates`);
    }
    return {
        layout: (0, layoutBuilder_1.buildMixedDashboardLayout)(chartTypes, artifactIds, surfaceKind),
        notes: [],
    };
}
function defaultChartTypesForTemplate(templateId) {
    const file = path_1.default.join((0, shared_1.pluginRootDir)(), "assets", "layout-templates", `${templateId}.json`);
    if (!(0, fs_1.existsSync)(file)) {
        return [];
    }
    const tpl = JSON.parse((0, fs_1.readFileSync)(file, "utf-8"));
    return tpl.slots
        .filter((s) => s.type === "chart")
        .map((s) => s.defaultChartType ?? "bar");
}
