import { describe, expect, it } from "vitest";
import { canSubmitDataset, datasetSubmitBlockers } from "./DatasetEditorForm";
import { EMPTY_BIND_DRAFT } from "./components/datasetFieldWorkbenchState";

const baseValues = {
  datasetId: "ds-orders",
  displayName: "订单分析集",
  tables: [{ name: "sample_db.daily_kpi" }],
  computedFields: [],
  allowedRoles: ["analyst"],
  bindDraft: EMPTY_BIND_DRAFT,
};

describe("canSubmitDataset", () => {
  it("allows create when required fields and table are present", () => {
    expect(canSubmitDataset(baseValues)).toBe(true);
    expect(datasetSubmitBlockers(baseValues)).toEqual([]);
  });

  it("ignores empty computed-field draft rows", () => {
    expect(
      canSubmitDataset({
        ...baseValues,
        computedFields: [{ name: "", expression: "" }],
      }),
    ).toBe(true);
  });

  it("blocks when a computed field row is partially filled", () => {
    const blockers = datasetSubmitBlockers({
      ...baseValues,
      computedFields: [{ name: "amt2", expression: "" }],
    });
    expect(canSubmitDataset({ ...baseValues, computedFields: [{ name: "amt2", expression: "" }] })).toBe(
      false,
    );
    expect(blockers).toContain("补全计算字段的名称与表达式，或删除空行");
  });

  it("blocks when table name is missing", () => {
    expect(
      canSubmitDataset({
        ...baseValues,
        tables: [{ name: "  " }],
      }),
    ).toBe(false);
    expect(datasetSubmitBlockers({ ...baseValues, tables: [{ name: "  " }] })).toContain(
      "在 Schema 树中选择数据表",
    );
  });
});
