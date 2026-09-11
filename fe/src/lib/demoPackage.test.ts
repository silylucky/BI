import { describe, expect, it } from "vitest";
import {
  isDemoPackageDashboard,
  isDemoPackageDatasource,
  isDemoPackageDataset,
  isProtectedDemoDatasource,
  readDemoPackageMeta,
  shouldShowOfficialDemoBadge,
} from "./demoPackage";

describe("demoPackage", () => {
  it("detects demo datasource code", () => {
    expect(isDemoPackageDatasource("demo")).toBe(true);
    expect(isDemoPackageDatasource("prod")).toBe(false);
  });

  it("detects protected demo datasource", () => {
    expect(isProtectedDemoDatasource({ code: "demo" })).toBe(true);
    expect(isProtectedDemoDatasource({ code: "custom", isDemoPackage: true })).toBe(true);
    expect(isProtectedDemoDatasource({ code: "prod" })).toBe(false);
  });

  it("detects demo package dataset", () => {
    expect(isDemoPackageDataset("demo-sales-wide", "【官方示例】区域销售宽表")).toBe(true);
    expect(isDemoPackageDataset("custom-ds", "【官方示例】测试")).toBe(true);
    expect(isDemoPackageDataset("my-dataset", "业务数据集")).toBe(false);
  });

  it("detects demo dashboard by Chinese slug, legacy slug or layout meta", () => {
    expect(isDemoPackageDashboard({ slug: "官方示例-双栏指标看板" })).toBe(true);
    expect(isDemoPackageDashboard({ slug: "demo-dual-kpi" })).toBe(true);
    expect(
      isDemoPackageDashboard({
        slug: "custom-board",
        layoutJson: {
          version: 1,
          widgets: [],
          globalFilters: [],
          demoPackage: { seed: true, sourceTemplateKey: "builtin-dash-dual-kpi" },
        },
      }),
    ).toBe(true);
    expect(isDemoPackageDashboard({ slug: "custom-board" })).toBe(false);
  });

  it("hides official demo badge when title already labels demo", () => {
    expect(
      shouldShowOfficialDemoBadge({
        slug: "官方示例-双栏指标看板",
        name: "官方示例 · 双栏指标看板",
      }),
    ).toBe(false);
    expect(
      shouldShowOfficialDemoBadge({
        slug: "官方示例-双栏指标看板",
        name: "我的销售看板",
      }),
    ).toBe(true);
  });

  it("reads demo package meta only when seeded", () => {
    expect(
      readDemoPackageMeta({
        version: 1,
        widgets: [],
        globalFilters: [],
        demoPackage: { seed: true },
      }),
    ).toEqual({ seed: true });
    expect(
      readDemoPackageMeta({
        version: 1,
        widgets: [],
        globalFilters: [],
        demoPackage: { seed: false },
      }),
    ).toBeNull();
  });
});
