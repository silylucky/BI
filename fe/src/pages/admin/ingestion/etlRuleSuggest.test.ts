import { describe, expect, it } from "vitest";
import { suggestEtlRulesFromColumns, summarizeEtlRules } from "./etlRuleSuggest";

describe("suggestEtlRulesFromColumns", () => {
  it("suggests cast for string-like amount column", () => {
    const rules = suggestEtlRulesFromColumns([
      { name: "amount", dataType: "varchar" },
      { name: "id", dataType: "int" },
    ]);
    expect(rules).toContainEqual({ type: "cast_type", column: "amount", to: "float" });
    expect(rules.some((r) => r.column === "id")).toBe(false);
  });

  it("adds status deleted filter when status column exists", () => {
    const rules = suggestEtlRulesFromColumns([{ name: "status", dataType: "varchar" }]);
    expect(rules).toContainEqual({
      type: "filter_rows",
      column: "status",
      op: "ne",
      value: "deleted",
    });
  });

  it("suggests rename for product_name column", () => {
    const rules = suggestEtlRulesFromColumns([{ name: "product_name", dataType: "varchar" }]);
    expect(rules).toContainEqual({ type: "rename_column", from: "product_name", to: "product" });
  });

  it("suggests fill_null for note column", () => {
    const rules = suggestEtlRulesFromColumns([{ name: "note", dataType: "text" }]);
    expect(rules).toContainEqual({ type: "fill_null", column: "note", value: "无备注" });
  });
  it("suggests rename for metric_name column", () => {
    const rules = suggestEtlRulesFromColumns([{ name: "metric_name", dataType: "varchar" }]);
    expect(rules).toContainEqual({ type: "rename_column", from: "metric_name", to: "metric" });
  });

  it("suggests rules for all coverable columns in a metric table", () => {
    const rules = suggestEtlRulesFromColumns([
      { name: "record_id", dataType: "varchar" },
      { name: "metric_name", dataType: "varchar" },
      { name: "metric_value", dataType: "varchar" },
      { name: "remarks", dataType: "text" },
      { name: "is_active", dataType: "varchar" },
      { name: "status", dataType: "varchar" },
    ]);
    expect(rules.length).toBe(6);
    expect(rules).toContainEqual({ type: "cast_type", column: "metric_value", to: "float" });
  });
});

describe("summarizeEtlRules", () => {
  it("returns empty summary", () => {
    expect(summarizeEtlRules([])).toBe("无额外规则（同步时默认自动清洗）");
  });

  it("summarizes mixed rules", () => {
    const summary = summarizeEtlRules([
      { type: "rename_column", from: "product_name", to: "product" },
      { type: "cast_type", column: "amount", to: "float" },
    ]);
    expect(summary).toContain("product_name→product");
    expect(summary).toContain("amount→float");
  });
});
