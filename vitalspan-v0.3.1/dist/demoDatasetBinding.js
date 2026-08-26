"use strict";
/** 与 backend/app/dashboard/templates/rebind_demo_encodings.py 保持语义一致 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEMO_DATASET_GRID = exports.DEMO_DATASET_GEO = exports.DEMO_DATASET_DETAIL = exports.DEMO_DATASET_WIDE = void 0;
exports.encodingFor = encodingFor;
exports.applyDemoEncodingToChartConfig = applyDemoEncodingToChartConfig;
exports.DEMO_DATASET_WIDE = "demo-sales-wide";
exports.DEMO_DATASET_DETAIL = "demo-sales-detail";
exports.DEMO_DATASET_GEO = "demo-v-sales-geo";
exports.DEMO_DATASET_GRID = "demo-gov-grid-stats";
const GRID_TITLE_KEYS = ["网格", "事件", "待办", "台账", "整改", "发现"];
const MAP_TITLE_KEYS = ["热力", "区域分布", "区域态势", "地图"];
const GOV_ANALYTICS_KEYS = ["政务", "满意度", "水质", "效能", "部门"];
function refs(fields) {
    return fields.map((field) => ({ field, label: null }));
}
function axesRefs(mapping) {
    const out = {};
    for (const [key, names] of Object.entries(mapping)) {
        out[key] = refs(names);
    }
    return out;
}
function pack(datasetId, dims, mets, axes) {
    return { datasetId, dimensions: dims, metrics: mets, axes };
}
function encodingFor(chartType, title) {
    const t = title || "";
    if (chartType === "map" || chartType === "map-3d" || MAP_TITLE_KEYS.some((k) => t.includes(k))) {
        return pack(exports.DEMO_DATASET_GEO, ["province", "city", "district"], ["amount"], { xAxis: ["province"], yAxis: ["amount"], drill: ["city", "district"] });
    }
    const gridish = GRID_TITLE_KEYS.some((k) => t.includes(k));
    if (gridish && (chartType === "table-info" || chartType === "table" || chartType === "table-normal")) {
        const cols = ["grid_name", "event_count", "resolved_count"];
        return pack(exports.DEMO_DATASET_GRID, cols, [], { xAxis: cols });
    }
    if (gridish &&
        [
            "bar-range",
            "bidirectional-bar",
            "bullet-graph",
            "quadrant",
            "scatter",
            "chart-mix-group",
            "bar-stack",
            "bar-stack-horizontal",
        ].includes(chartType)) {
        return pack(exports.DEMO_DATASET_GRID, ["grid_name"], ["event_count", "resolved_count"], { xAxis: ["grid_name"], yAxis: ["event_count"], yAxisExt: ["resolved_count"] });
    }
    if (gridish) {
        return pack(exports.DEMO_DATASET_GRID, ["grid_name"], ["event_count"], { xAxis: ["grid_name"], yAxis: ["event_count"] });
    }
    const govish = GOV_ANALYTICS_KEYS.some((k) => t.includes(k));
    if (govish) {
        if (chartType === "map" || chartType === "map-3d" || MAP_TITLE_KEYS.some((k) => t.includes(k))) {
            return pack(exports.DEMO_DATASET_GEO, ["province", "city", "district"], ["amount"], { xAxis: ["province"], yAxis: ["amount"], drill: ["city", "district"] });
        }
        if (chartType === "gauge" || t.includes("水质")) {
            return pack(exports.DEMO_DATASET_GRID, [], ["resolved_count"], { yAxis: ["resolved_count"] });
        }
        if (chartType === "line" || chartType === "area" || chartType === "timeline" || t.includes("趋势")) {
            return pack(exports.DEMO_DATASET_WIDE, ["sale_date"], ["amount"], { xAxis: ["sale_date"], yAxis: ["amount"] });
        }
        if (chartType === "bar-stack-horizontal") {
            return pack(exports.DEMO_DATASET_GRID, ["grid_name"], ["event_count", "resolved_count"], { xAxis: ["grid_name"], yAxis: ["event_count", "resolved_count"] });
        }
        if (chartType === "bar-stack" || chartType === "chart-mix-group" || chartType === "chart-mix-stack") {
            return pack(exports.DEMO_DATASET_GRID, ["grid_name"], ["event_count", "resolved_count"], { xAxis: ["grid_name"], yAxis: ["event_count", "resolved_count"] });
        }
        if (chartType === "bar") {
            return pack(exports.DEMO_DATASET_GRID, ["grid_name"], ["event_count"], { xAxis: ["grid_name"], yAxis: ["event_count"] });
        }
        return pack(exports.DEMO_DATASET_GRID, ["grid_name"], ["event_count"], { xAxis: ["grid_name"], yAxis: ["event_count"] });
    }
    const catalog = {
        kpi: pack(exports.DEMO_DATASET_WIDE, [], ["amount"], { yAxis: ["amount"] }),
        gauge: pack(exports.DEMO_DATASET_WIDE, [], ["amount"], { yAxis: ["amount"] }),
        liquid: pack(exports.DEMO_DATASET_WIDE, [], ["amount"], { yAxis: ["amount"] }),
        line: pack(exports.DEMO_DATASET_WIDE, ["sale_date"], ["amount"], { xAxis: ["sale_date"], yAxis: ["amount"] }),
        area: pack(exports.DEMO_DATASET_WIDE, ["sale_date"], ["amount"], { xAxis: ["sale_date"], yAxis: ["amount"] }),
        "area-stack": pack(exports.DEMO_DATASET_WIDE, ["sale_date"], ["amount"], {
            xAxis: ["sale_date"],
            yAxis: ["amount"],
        }),
        timeline: pack(exports.DEMO_DATASET_WIDE, ["sale_date"], ["amount"], {
            xAxis: ["sale_date"],
            yAxis: ["amount"],
        }),
        "chart-mix": pack(exports.DEMO_DATASET_WIDE, ["sale_date"], ["amount"], {
            xAxis: ["sale_date"],
            yAxis: ["amount"],
        }),
        "chart-mix-group": pack(exports.DEMO_DATASET_WIDE, ["sale_date"], ["amount", "quantity"], { xAxis: ["sale_date"], yAxis: ["amount"], yAxisExt: ["quantity"] }),
        "chart-mix-stack": pack(exports.DEMO_DATASET_WIDE, ["sale_date"], ["amount", "quantity"], { xAxis: ["sale_date"], yAxis: ["amount"], yAxisExt: ["quantity"] }),
        bar: pack(exports.DEMO_DATASET_WIDE, ["category_name"], ["amount"], {
            xAxis: ["category_name"],
            yAxis: ["amount"],
        }),
        "bar-horizontal": pack(exports.DEMO_DATASET_WIDE, ["province"], ["amount"], {
            xAxis: ["province"],
            yAxis: ["amount"],
        }),
        "bar-stack": pack(exports.DEMO_DATASET_WIDE, ["category_name"], ["amount", "quantity"], {
            xAxis: ["category_name"],
            yAxis: ["amount", "quantity"],
        }),
        "bar-stack-horizontal": pack(exports.DEMO_DATASET_WIDE, ["category_name"], ["amount", "quantity"], {
            xAxis: ["category_name"],
            yAxis: ["amount", "quantity"],
        }),
        "bar-group": pack(exports.DEMO_DATASET_WIDE, ["category_name"], ["amount"], {
            xAxis: ["category_name"],
            yAxis: ["amount"],
        }),
        pie: pack(exports.DEMO_DATASET_WIDE, ["category_name"], ["amount"], {
            xAxis: ["category_name"],
            yAxis: ["amount"],
        }),
        "pie-donut": pack(exports.DEMO_DATASET_WIDE, ["category_name"], ["amount"], {
            xAxis: ["category_name"],
            yAxis: ["amount"],
        }),
        "pie-rose": pack(exports.DEMO_DATASET_WIDE, ["category_name"], ["amount"], {
            xAxis: ["category_name"],
            yAxis: ["amount"],
        }),
        "pie-donut-rose": pack(exports.DEMO_DATASET_WIDE, ["category_name"], ["amount"], {
            xAxis: ["category_name"],
            yAxis: ["amount"],
        }),
        radar: pack(exports.DEMO_DATASET_WIDE, ["category_name"], ["amount"], {
            xAxis: ["category_name"],
            yAxis: ["amount"],
        }),
        treemap: pack(exports.DEMO_DATASET_WIDE, ["category_name"], ["amount"], {
            xAxis: ["category_name"],
            yAxis: ["amount"],
        }),
        "circle-packing": pack(exports.DEMO_DATASET_WIDE, ["category_name"], ["amount"], {
            xAxis: ["category_name"],
            yAxis: ["amount"],
        }),
        funnel: pack(exports.DEMO_DATASET_WIDE, ["category_name"], ["amount"], {
            xAxis: ["category_name"],
            yAxis: ["amount"],
        }),
        "word-cloud": pack(exports.DEMO_DATASET_WIDE, ["product_name"], ["amount"], {
            xAxis: ["product_name"],
            yAxis: ["amount"],
        }),
        scatter: pack(exports.DEMO_DATASET_WIDE, ["product_name"], ["quantity", "amount"], {
            xAxis: ["product_name"],
            yAxis: ["quantity"],
            yAxisExt: ["amount"],
        }),
        quadrant: pack(exports.DEMO_DATASET_WIDE, ["product_name"], ["amount", "quantity"], {
            xAxis: ["product_name"],
            yAxis: ["amount"],
            yAxisExt: ["quantity"],
            extBubble: ["quantity"],
        }),
        "bar-range": pack(exports.DEMO_DATASET_WIDE, ["category_name"], ["amount", "quantity"], {
            xAxis: ["category_name"],
            yAxis: ["amount"],
            yAxisExt: ["quantity"],
        }),
        "bidirectional-bar": pack(exports.DEMO_DATASET_DETAIL, ["channel"], ["quantity", "amount"], {
            xAxis: ["channel"],
            yAxis: ["quantity"],
            yAxisExt: ["amount"],
        }),
        "bullet-graph": pack(exports.DEMO_DATASET_WIDE, ["category_name"], ["amount", "quantity"], {
            xAxis: ["category_name"],
            yAxis: ["amount"],
            yAxisExt: ["quantity"],
        }),
        "stock-line": pack(exports.DEMO_DATASET_WIDE, ["sale_date"], ["amount", "quantity", "amount", "quantity"], { xAxis: ["sale_date"], yAxis: ["amount", "quantity", "amount", "quantity"] }),
        "table-info": pack(exports.DEMO_DATASET_WIDE, ["product_name", "category_name", "province"], [], { xAxis: ["product_name", "category_name", "province"] }),
        "table-normal": pack(exports.DEMO_DATASET_WIDE, ["sale_date", "province", "category_name"], ["amount", "quantity"], { xAxis: ["sale_date", "province", "category_name"], yAxis: ["amount", "quantity"] }),
        "table-pivot": pack(exports.DEMO_DATASET_WIDE, ["category_name", "province"], ["amount"], {
            xAxis: ["category_name", "province"],
            yAxis: ["amount"],
        }),
    };
    if (catalog[chartType]) {
        return catalog[chartType];
    }
    return pack(exports.DEMO_DATASET_WIDE, ["sale_date"], ["amount"], { xAxis: ["sale_date"], yAxis: ["amount"] });
}
function applyDemoEncodingToChartConfig(chartType, chartId, title, styleVariant = "default") {
    const enc = encodingFor(chartType, title);
    return {
        chartType,
        styleVariant,
        chartId,
        mode: "dataset",
        dataSourceId: "__demo:sample_db__",
        bindingId: null,
        sql: null,
        schema: null,
        table: null,
        configId: null,
        datasetId: enc.datasetId,
        dimensions: refs(enc.dimensions),
        metrics: refs(enc.metrics),
        axes: axesRefs(enc.axes),
        filters: [],
        timeRange: null,
        index: null,
        nativeBody: { deStyle: { paletteId: "default" } },
    };
}
