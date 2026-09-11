import { describe, expect, it } from "vitest";
import {
  evaluateDraftThemeCapabilities,
  listMappingColumnOptions,
  mergeSuggestedFieldMapping,
  suggestStandardFieldMapping,
  validateCreatedAtFieldMapping,
  validateStandardPackDraft,
} from "./standardAnalysisValidation";
import type { AnalysisPack } from "./useStandardAnalysis";

const basePack: AnalysisPack = {
  packKey: "equipment-overview",
  displayName: "设备标准分析",
  datasetId: "equipment_clean",
  boundConfigId: "b376b0e5-01ad-4c26-beb8-714c6553e7be",
  dataSourceId: "00e7438c-33ac-4239-88a5-af28ecdece19",
  fieldMapping: { status: "", region: "", createdAt: "" },
  enabledThemes: ["lifecycle", "distribution"],
  allowedRoles: ["analyst", "admin"],
  snapshotCronPreset: "daily",
  snapshotRetentionPeriods: 12,
};

describe("standardAnalysisValidation", () => {
  it("suggests common equipment columns", () => {
    expect(suggestStandardFieldMapping(["id", "status", "region", "created_at"])).toEqual({
      status: "status",
      region: "region",
      createdAt: "created_at",
    });
  });

  it("suggests geo dataset columns with city as region", () => {
    expect(
      suggestStandardFieldMapping(["province", "city", "district", "amount", "region_map", "sale_count"]),
    ).toEqual({
      status: "",
      region: "city",
      createdAt: "",
    });
  });

  it("keeps valid custom mapping and fills empty slots", () => {
    expect(
      mergeSuggestedFieldMapping(
        { status: "custom_status", region: "", createdAt: "" },
        ["custom_status", "region", "created_at"],
      ),
    ).toEqual({
      status: "custom_status",
      region: "region",
      createdAt: "created_at",
    });
  });

  it("replaces invalid time mapping with suggestion", () => {
    expect(
      mergeSuggestedFieldMapping(
        { status: "province", region: "region_map", createdAt: "sale_count" },
        ["province", "city", "district", "amount", "region_map", "sale_count"],
      ),
    ).toEqual({
      status: "province",
      region: "region_map",
      createdAt: "",
    });
  });

  it("filters time field options to date-like columns", () => {
    expect(
      listMappingColumnOptions("createdAt", ["province", "city", "sale_date", "amount"]),
    ).toEqual(["sale_date"]);
  });

  it("rejects mapping that does not exist in dataset columns", () => {
    const message = validateStandardPackDraft(
      {
        ...basePack,
        fieldMapping: { status: "status", region: "region", createdAt: "created_at" },
      },
      ["order_id", "amount"],
    );
    expect(message).toMatch(/不在当前数据集列中/);
  });

  it("rejects numeric column mapped as createdAt when time themes enabled", () => {
    const message = validateCreatedAtFieldMapping(
      {
        ...basePack,
        enabledThemes: ["activity"],
        fieldMapping: { status: "status", region: "region", createdAt: "amount" },
      },
      { amount: "metric" },
    );
    expect(message).toMatch(/指标/);
  });

  it("rejects suspicious numeric field name for createdAt", () => {
    const message = validateCreatedAtFieldMapping(
      {
        ...basePack,
        enabledThemes: ["trend"],
        fieldMapping: { status: "status", region: "region", createdAt: "amount" },
      },
    );
    expect(message).toMatch(/疑似数值列/);
  });

  it("flags unavailable enabled themes in validateStandardPackDraft", () => {
    const message = validateStandardPackDraft(
      {
        ...basePack,
        enabledThemes: ["trend"],
        fieldMapping: { status: "status", region: "region", createdAt: "amount" },
      },
      ["status", "region", "amount"],
    );
    expect(message).toMatch(/趋势/);
  });

  it("evaluates draft theme capabilities from column mapping", () => {
    const caps = evaluateDraftThemeCapabilities(
      {
        ...basePack,
        fieldMapping: { status: "status", region: "province", createdAt: "" },
      },
      ["status", "province", "amount"],
    );
    expect(caps.find((item) => item.theme === "distribution")?.available).toBe(true);
    expect(caps.find((item) => item.theme === "trend")?.available).toBe(false);
  });
});
