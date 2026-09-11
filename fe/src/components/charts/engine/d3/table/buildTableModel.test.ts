import { describe, expect, it } from "vitest";
import { buildPivotTableModel, buildDetailTableModel } from "./buildTableModel";

describe("buildTableModel", () => {
  it("builds detail columns from dimensions and metrics", () => {
    const model = buildDetailTableModel({
      plotType: "table-info",
      columns: ["region", "amount", "extra"],
      rows: [["华东", 10, 1]],
      spec: {
        encoding: {
          dimensions: [{ field: "region", label: "区域" }],
          metrics: [{ field: "amount", label: "金额" }],
        },
      } as never,
    });
    expect(model.kind).toBe("detail");
    expect(model.columns).toEqual(["region", "amount"]);
    expect(model.columnMeta[0]?.label).toBe("区域");
  });

  it("prefers xAxis column order from encoding.axes for detail table", () => {
    const model = buildDetailTableModel({
      plotType: "table-info",
      columns: ["region", "amount", "sale_date"],
      rows: [["华东", 10, "2025-01-01"]],
      spec: {
        encoding: {
          dimensions: [{ field: "region" }],
          metrics: [{ field: "amount" }, { field: "sale_date" }],
          axes: {
            xAxis: [{ field: "amount" }, { field: "region" }, { field: "sale_date" }],
          },
        },
      } as never,
    });
    expect(model.columns).toEqual(["amount", "region", "sale_date"]);
    expect(model.columnMeta[0]?.label).toBe("金额");
    expect(model.columnMeta[1]?.label).toBe("区域");
  });

  it("aggregates pivot cells by row and column keys", () => {
    const model = buildPivotTableModel({
      plotType: "table-pivot",
      columns: ["product", "city", "amount"],
      rows: [
        ["A", "北京", 10],
        ["A", "上海", 20],
        ["B", "北京", 5],
      ],
      spec: {
        encoding: {
          dimensions: [
            { field: "product", label: "产品" },
            { field: "city", label: "城市" },
          ],
          metrics: [{ field: "amount", label: "销售额" }],
        },
      } as never,
    });
    expect(model.rowKeys).toEqual(["A", "B"]);
    expect(model.colKeys).toEqual(["北京", "上海"]);
    expect(model.cells.A?.北京?.amount).toBe(10);
    expect(model.cells.A?.上海?.amount).toBe(20);
    expect(model.cells.B?.北京?.amount).toBe(5);
  });

  it("respects pivot total visibility options", () => {
    const input = {
      plotType: "table-pivot" as const,
      columns: ["product", "city", "amount"],
      rows: [["A", "北京", 10]],
      spec: {
        encoding: {
          dimensions: [{ field: "product" }, { field: "city" }],
          metrics: [{ field: "amount" }],
        },
      } as never,
    };
    expect(buildPivotTableModel(input, { showRowTotal: false }).showRowTotal).toBe(false);
    expect(buildPivotTableModel(input, { showColTotal: false }).showColTotal).toBe(false);
  });
});
