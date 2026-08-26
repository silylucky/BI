"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEMPLATE_DEMO_DATASOURCE_REF = void 0;
exports.demoChartTitle = demoChartTitle;
exports.buildDemoChartConfig = buildDemoChartConfig;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const demoDatasetBinding_1 = require("./demoDatasetBinding");
const shared_1 = require("./shared");
exports.TEMPLATE_DEMO_DATASOURCE_REF = "__demo:sample_db__";
let cached = null;
function loadDemoQueries() {
    if (cached) {
        return cached;
    }
    const file = path_1.default.join((0, shared_1.pluginRootDir)(), "assets", "official-demo-chart-queries.json");
    if (!(0, fs_1.existsSync)(file)) {
        cached = { version: 1, dataSourceRef: exports.TEMPLATE_DEMO_DATASOURCE_REF, queries: {} };
        return cached;
    }
    cached = JSON.parse((0, fs_1.readFileSync)(file, "utf-8"));
    return cached;
}
function demoChartTitle(chartType) {
    return loadDemoQueries().queries[chartType]?.title;
}
/** 内置图演示绑定：Dataset 模式 + 官方示例字段编码（禁止 SQL，与 FE isChartExecuteReady 对齐） */
function buildDemoChartConfig(chartType, chartId, styleVariant = "default", title = "") {
    const resolvedTitle = title.trim() || demoChartTitle(chartType) || "";
    return (0, demoDatasetBinding_1.applyDemoEncodingToChartConfig)(chartType, chartId, resolvedTitle, styleVariant);
}
