import { describe, expect, it } from "vitest";
import {
  buildStandardAnalysisDataMetaNote,
  buildStandardAnalysisDataWarningNote,
} from "./standardAnalysisDataMeta";

describe("buildStandardAnalysisDataMetaNote", () => {
  it("returns null when meta is absent", () => {
    expect(buildStandardAnalysisDataMetaNote(undefined)).toBeNull();
  });

  it("describes sample-based distribution with top N truncation", () => {
    const note = buildStandardAnalysisDataMetaNote({
      sampleBased: true,
      sourceRowCount: 3200,
      queryLimit: 5000,
      topN: 20,
      topNTruncated: true,
    });
    expect(note).toBe("基于 3,200 行样本聚合，维度 Top 20（其余合并为「其他」）。");
  });

  it("describes weekly time series with point cap", () => {
    const note = buildStandardAnalysisDataMetaNote({
      sampleBased: true,
      sourceRowCount: 5000,
      queryLimit: 5000,
      timeStepLabel: "按周",
      pointCap: 52,
      pointCapApplied: true,
    });
    expect(note).toBe(
      "基于 5,000 行样本聚合（已达查询上限 5,000 行），按周展示，仅保留最近 52 个时间点。",
    );
  });
});

describe("buildStandardAnalysisDataWarningNote", () => {
  it("returns null for routine sample aggregation", () => {
    expect(
      buildStandardAnalysisDataWarningNote({
        sampleBased: true,
        sourceRowCount: 600,
        queryLimit: 5000,
        timeStepLabel: "按日",
        pointCap: 90,
        pointCapApplied: true,
      }),
    ).toBeNull();
  });

  it("warns when query limit is reached", () => {
    const note = buildStandardAnalysisDataWarningNote({
      sampleBased: true,
      sourceRowCount: 5000,
      queryLimit: 5000,
    });
    expect(note).toContain("查询已触达上限");
    expect(note).toContain("5,000");
  });

  it("warns when top N is truncated", () => {
    const note = buildStandardAnalysisDataWarningNote({
      topN: 20,
      topNTruncated: true,
    });
    expect(note).toContain("Top 20");
  });

  it("includes translation note when present", () => {
    const note = buildStandardAnalysisDataWarningNote({
      translationNote: "部分码值未翻译（2 项）",
    });
    expect(note).toContain("部分码值未翻译");
  });
});
