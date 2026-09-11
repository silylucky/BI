import { describe, expect, it } from "vitest";
import {
  DE_AXIS_CATALOG,
  deriveFieldRuleFromDeCatalog,
  getDeAxisBlueprint,
  getDeAxisSpecs,
} from "@/lib/chartDeAxis";
import { BUILTIN_PLUGIN_DEFS } from "@/components/charts/engine/plugins/metadata";

const ACTIVE_TYPES = BUILTIN_PLUGIN_DEFS.filter((d) => !d.deprecated).map((d) => d.type);

describe("chartDeAxis catalog", () => {
  it("covers all active chart types", () => {
    for (const type of ACTIVE_TYPES) {
      expect(DE_AXIS_CATALOG[type], type).toBeDefined();
      expect(getDeAxisSpecs(type).length, type).toBeGreaterThan(0);
      expect(getDeAxisBlueprint(type).length, type).toBeGreaterThan(0);
    }
  });

  it("kpi has single metric slot like DataEase", () => {
    const slots = getDeAxisBlueprint("kpi");
    expect(slots).toHaveLength(1);
    expect(slots[0]?.label).toBe("指标");
    expect(slots[0]?.fieldType).toBe("metric");
    expect(deriveFieldRuleFromDeCatalog("kpi")).toEqual({
      minDimensions: 0,
      maxDimensions: 0,
      minMetrics: 1,
      maxMetrics: 1,
    });
  });

  it("stock-line uses single yAxis with 4 metric slots", () => {
    const slots = getDeAxisBlueprint("stock-line");
    const ySlots = slots.filter((s) => s.axisId === "yAxis");
    expect(ySlots).toHaveLength(4);
    expect(ySlots.every((s) => s.fieldType === "metric")).toBe(true);
  });

  it("line uses DataEase cartesian trend slots with multi-metric yAxis", () => {
    const slots = getDeAxisBlueprint("line");
    expect(slots.map((s) => s.label)).toEqual([
      "类别轴 / 维度",
      "子类别 / 维度",
      "值轴 / 指标",
      "钻取 / 维度",
    ]);
    expect(slots[0]).toMatchObject({
      axisId: "xAxis",
      fieldType: "dimension",
      uiMode: "multi",
    });
    expect(deriveFieldRuleFromDeCatalog("line")).toEqual({
      minDimensions: 1,
      maxDimensions: 8,
      minMetrics: 1,
      maxMetrics: 8,
    });
  });

  it("table-normal uses multi dimension and metric containers like DataEase", () => {
    const slots = getDeAxisBlueprint("table-normal");
    expect(slots.map((s) => s.label)).toEqual([
      "数据列 / 维度",
      "数据列 / 指标",
      "钻取 / 维度",
    ]);
    expect(slots[0]).toMatchObject({
      axisId: "xAxis",
      fieldType: "dimension",
      uiMode: "multi",
    });
    expect(slots[1]).toMatchObject({
      axisId: "yAxis",
      fieldType: "metric",
      uiMode: "multi",
    });
    expect(deriveFieldRuleFromDeCatalog("table-normal")).toEqual({
      minDimensions: 1,
      maxDimensions: 9,
      minMetrics: 1,
      maxMetrics: 8,
    });
  });

  it("table-info uses multi data column container + drill like DataEase", () => {
    const slots = getDeAxisBlueprint("table-info");
    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({
      fieldType: "both",
      label: "数据列 / 维度或指标",
      uiMode: "multi",
      axisId: "xAxis",
    });
    expect(slots[1]).toMatchObject({
      label: "钻取 / 维度",
      fieldType: "dimension",
      axisId: "drill",
    });
    expect(deriveFieldRuleFromDeCatalog("table-info")).toEqual({
      minDimensions: 0,
      maxDimensions: 9,
      minMetrics: 0,
      maxMetrics: 8,
    });
  });

  it("multi-scatter DE axis order and labels", () => {
    expect(getDeAxisBlueprint("multi-scatter").map((s) => s.label)).toEqual([
      "颜色 / 维度",
      "X 轴 / 时间维度或指标",
      "Y 轴 / 指标",
      "明暗 / 指标",
      "气泡大小 / 指标",
    ]);
  });

  it("chart-mix-dual-line includes extBubble dimension slot", () => {
    const slots = getDeAxisBlueprint("chart-mix-dual-line");
    expect(slots.map((s) => s.label)).toEqual([
      "类别轴 / 维度",
      "左子类别 / 维度",
      "左值轴 / 线指标",
      "右子类别 / 维度",
      "右值轴 / 线指标",
      "钻取 / 维度",
    ]);
    const bubble = slots.find((s) => s.axisId === "extBubble");
    expect(bubble?.label).toBe("右子类别 / 维度");
    expect(bubble?.fieldType).toBe("dimension");
  });

  it("chart-mix matches DataEase dual-axis slots (右子类别 on extBubble)", () => {
    expect(getDeAxisBlueprint("chart-mix").map((s) => s.label)).toEqual([
      "类别轴 / 维度",
      "左值轴 / 柱指标",
      "右子类别 / 维度",
      "右值轴 / 线指标",
      "钻取 / 维度",
    ]);
  });

  it("DE parity matrix: every catalog entry has valid field types", () => {
    for (const [type, entry] of Object.entries(DE_AXIS_CATALOG)) {
      for (const spec of entry.specs) {
        expect(["dimension", "metric", "both"]).toContain(spec.fieldType);
        expect(spec.limit).toBeGreaterThan(0);
      }
      const rule = deriveFieldRuleFromDeCatalog(type);
      expect(rule.maxDimensions).toBeGreaterThanOrEqual(rule.minDimensions);
      expect(rule.maxMetrics).toBeGreaterThanOrEqual(rule.minMetrics);
    }
  });
});
