import { describe, expect, it } from "vitest";
import {
  suggestCustomVizFields,
  validateCustomVizFieldAssignment,
} from "./customVizFieldAssignment";

describe("validateCustomVizFieldAssignment", () => {
  it("rejects metric in dimension slot", () => {
    const result = validateCustomVizFieldAssignment(
      "amount",
      { kind: "dimension", index: 0 },
      undefined,
      "时间维度",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("指标字段");
  });

  it("rejects dimension in metric slot", () => {
    const result = validateCustomVizFieldAssignment(
      "sale_date",
      { kind: "metric", index: 0 },
      undefined,
      "数值指标 1",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("维度字段");
  });

  it("requires date field for time dimension label", () => {
    const result = validateCustomVizFieldAssignment(
      "province",
      { kind: "dimension", index: 0 },
      undefined,
      "时间维度",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("sale_date");
  });

  it("accepts sale_date in time dimension slot", () => {
    expect(
      validateCustomVizFieldAssignment(
        "sale_date",
        { kind: "dimension", index: 0 },
        undefined,
        "时间维度",
        "date",
      ).ok,
    ).toBe(true);
  });

  it("accepts amount in detail-table dimension multi slot", () => {
    expect(
      validateCustomVizFieldAssignment(
        "amount",
        { kind: "dimension", index: 0 },
        {
          dimensions: { min: 1, max: 6, label: "明细列" },
          metrics: { min: 0, max: 0, label: "数值列" },
        },
        "明细列",
      ).ok,
    ).toBe(true);
  });

  it("accepts numeric columns in dimension slots when manifest wrongly requires metrics", () => {
    expect(
      validateCustomVizFieldAssignment(
        "amount",
        { kind: "dimension", index: 1 },
        {
          dimensions: { min: 1, max: 6, label: "明细列" },
          metrics: { min: 1, max: 1, label: "数值列" },
        },
        "明细列",
      ).ok,
    ).toBe(true);
  });

  it("suggestCustomVizFields fills detail-table columns even when metrics.min is wrongly set", () => {
    const { dimensions, metrics } = suggestCustomVizFields(
      ["flow_id", "flow_name", "amount"],
      {
        dimensions: { min: 1, max: 6, label: "明细列" },
        metrics: { min: 1, max: 1, label: "数值列" },
      },
    );
    expect(dimensions?.map((d) => d.field)).toEqual(["flow_id", "flow_name", "amount"]);
    expect(metrics).toEqual([]);
  });

  it("suggestCustomVizFields fills detail-table columns", () => {
    const { dimensions, metrics } = suggestCustomVizFields(
      ["province", "city", "district", "amount"],
      {
        dimensions: { min: 1, max: 6, label: "明细列" },
        metrics: { min: 0, max: 0, label: "数值列" },
      },
    );
    expect(dimensions?.map((d) => d.field)).toEqual(["province", "city", "district", "amount"]);
    expect(metrics).toEqual([]);
  });

  it("accepts amount in metric slot", () => {
    expect(
      validateCustomVizFieldAssignment(
        "amount",
        { kind: "metric", index: 0 },
        undefined,
        "数值指标 1",
      ).ok,
    ).toBe(true);
  });
});
