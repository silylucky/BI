import { describe, expect, it } from "vitest";
import { CARTESIAN_CATEGORY_KEY_SEP, formatCategoryCellValue, sortCompositeCategoryKeys } from "@/components/charts/engine/buildDatasetEncoding";
import {
  buildCategoryLevelSegments,
  pickCategoryBoundaryIndices,
  pickSynchronizedVisibleIndices,
  planHierarchicalCategoryAxis,
  resolveActiveCategoryLevels,
  resolveFinestLevelForThinning,
  resolveHierarchicalAxisLayout,
  resolveHierarchicalCategoryAxisRotate,
  splitCompositeCategoryParts,
} from "@/components/charts/engine/d3/core/hierarchicalAxis";

describe("hierarchical category axis", () => {
  const categories = [
    `云南省${CARTESIAN_CATEGORY_KEY_SEP}2025-01${CARTESIAN_CATEGORY_KEY_SEP}销量`,
    `云南省${CARTESIAN_CATEGORY_KEY_SEP}2025-02${CARTESIAN_CATEGORY_KEY_SEP}销量`,
    `江苏省${CARTESIAN_CATEGORY_KEY_SEP}2025-01${CARTESIAN_CATEGORY_KEY_SEP}销量`,
  ];

  it("formatCategoryCellValue suppresses null literals", () => {
    expect(formatCategoryCellValue(null)).toBe("");
    expect(formatCategoryCellValue("null")).toBe("");
    expect(formatCategoryCellValue("华东")).toBe("华东");
  });

  it("splitCompositeCategoryParts preserves dimension order", () => {
    expect(splitCompositeCategoryParts(categories[0]!, 3)).toEqual(["云南省", "2025-01", "销量"]);
  });

  it("buildCategoryLevelSegments merges consecutive level-0 labels", () => {
    const level0 = buildCategoryLevelSegments(categories, 0, 3);
    expect(level0).toEqual([
      { start: 0, end: 1, label: "云南省" },
      { start: 2, end: 2, label: "江苏省" },
    ]);
  });

  it("buildCategoryLevelSegments splits level-1 within region groups", () => {
    const level1 = buildCategoryLevelSegments(categories, 1, 3);
    expect(level1).toEqual([
      { start: 0, end: 0, label: "2025-01" },
      { start: 1, end: 1, label: "2025-02" },
      { start: 2, end: 2, label: "2025-01" },
    ]);
  });

  it("resolveActiveCategoryLevels skips all-empty dimension rows", () => {
    const sparse = [
      `云南省${CARTESIAN_CATEGORY_KEY_SEP}null${CARTESIAN_CATEGORY_KEY_SEP}null`,
      `江苏省${CARTESIAN_CATEGORY_KEY_SEP}null${CARTESIAN_CATEGORY_KEY_SEP}null`,
    ];
    expect(resolveActiveCategoryLevels(sparse, 3)).toEqual([0]);
  });

  it("resolveFinestLevelForThinning picks finest structural level", () => {
    const productCategory = [
      `无线鼠标${CARTESIAN_CATEGORY_KEY_SEP}外设配件`,
      `机械键盘${CARTESIAN_CATEGORY_KEY_SEP}外设配件`,
      `27寸显示器${CARTESIAN_CATEGORY_KEY_SEP}显示设备`,
    ];
    const active = resolveActiveCategoryLevels(productCategory, 2);
    expect(resolveFinestLevelForThinning(active)).toBe(1);
  });

  it("planHierarchicalCategoryAxis returns null when only one active level", () => {
    const sparse = [
      `云南省${CARTESIAN_CATEGORY_KEY_SEP}null`,
      `江苏省${CARTESIAN_CATEGORY_KEY_SEP}null`,
    ];
    expect(planHierarchicalCategoryAxis(sparse, 480)).toBeNull();
  });

  it("planHierarchicalCategoryAxis thins synchronized indices when categories are dense", () => {
    const dense = Array.from({ length: 24 }, (_, i) =>
      `产品${i}${CARTESIAN_CATEGORY_KEY_SEP}类目${Math.floor(i / 4)}`,
    );
    const plan = planHierarchicalCategoryAxis(dense, 320);
    expect(plan).not.toBeNull();
    expect(plan!.visibleCategories.length).toBeLessThan(dense.length);
    expect(plan!.activeLevels.length).toBe(2);
  });

  it("pickSynchronizedVisibleIndices spaces ticks by widest multi-level label", () => {
    const SEP = CARTESIAN_CATEGORY_KEY_SEP;
    const keys = Array.from({ length: 20 }, (_, i) =>
      `2025-01-${String(i + 1).padStart(2, "0")}${SEP}甘肃省${SEP}超长产品名称示例${SEP}外设配件`,
    );
    const active = resolveActiveCategoryLevels(keys, 4);
    const innerW = 480;
    const indices = pickSynchronizedVisibleIndices(keys, innerW, 4, active);
    expect(indices.length).toBeGreaterThan(0);
    expect(indices.length).toBeLessThan(keys.length);
    const toPx = (i: number) => (i / (keys.length - 1)) * innerW;
    for (let j = 1; j < indices.length; j += 1) {
      expect(toPx(indices[j]!) - toPx(indices[j - 1]!)).toBeGreaterThan(40);
    }
  });

  it("pickCategoryBoundaryIndices marks coarse-level group starts", () => {
    const keys = [
      `企业直销${CARTESIAN_CATEGORY_KEY_SEP}2025-01-01`,
      `企业直销${CARTESIAN_CATEGORY_KEY_SEP}2025-01-02`,
      `电商平台${CARTESIAN_CATEGORY_KEY_SEP}2025-01-03`,
    ];
    expect(pickCategoryBoundaryIndices(keys, 0, 2)).toEqual([0, 2]);
  });

  it("pickSynchronizedVisibleIndices keeps first and last when width allows", () => {
    const keys = Array.from({ length: 12 }, (_, i) =>
      `${i < 6 ? "企业直销" : "电商平台"}${CARTESIAN_CATEGORY_KEY_SEP}2025-01-${String((i % 6) + 1).padStart(2, "0")}`,
    );
    const active = resolveActiveCategoryLevels(keys, 2);
    const indices = pickSynchronizedVisibleIndices(keys, 960, 2, active);
    expect(indices[0]).toBe(0);
    expect(indices.length).toBeGreaterThan(2);
    const gaps = indices.slice(1).map((value, i) => value - indices[i]!);
    gaps.forEach((gap) => expect(gap).toBe(gaps[0]));
  });

  it("resolveHierarchicalAxisLayout reserves bottom space per active level", () => {
    expect(resolveHierarchicalAxisLayout(3).extraBottom).toBeGreaterThan(resolveHierarchicalAxisLayout(1).extraBottom);
  });

  it("planHierarchicalCategoryAxis shows four active levels when data is sorted by hierarchy", () => {
    const SEP = CARTESIAN_CATEGORY_KEY_SEP;
    const unsorted = [
      `2025-07-08${SEP}甘肃省${SEP}无线鼠标${SEP}外设配件`,
      `2025-05-22${SEP}江苏省${SEP}机械键盘${SEP}显示设备`,
      `2025-05-22${SEP}甘肃省${SEP}无线鼠标${SEP}外设配件`,
      `2025-07-08${SEP}江苏省${SEP}机械键盘${SEP}外设配件`,
      `2025-05-22${SEP}甘肃省${SEP}机械键盘${SEP}显示设备`,
      `2025-07-08${SEP}甘肃省${SEP}机械键盘${SEP}外设配件`,
    ];
    const plan = planHierarchicalCategoryAxis(unsorted, 640, { structuralLevelCount: 4 });
    expect(plan).not.toBeNull();
    expect(plan!.activeLevels).toEqual([0, 1, 2, 3]);
    expect(plan!.structuralLevelCount).toBe(4);
    const dateSegments = buildCategoryLevelSegments(
      sortCompositeCategoryKeys(unsorted, 4),
      0,
      4,
    );
    expect(dateSegments.some((segment) => segment.end > segment.start)).toBe(true);
  });

  it("resolveHierarchicalCategoryAxisRotate defaults to horizontal without explicit rotate", () => {
    expect(resolveHierarchicalCategoryAxisRotate(categories, 640)).toBe(0);
    expect(resolveHierarchicalCategoryAxisRotate(categories, 640, "auto", 3)).toBe(0);
  });

  it("resolveHierarchicalCategoryAxisRotate auto mode can tilt leaf labels on narrow width", () => {
    const dense = Array.from({ length: 12 }, (_, i) =>
      `云南省${CARTESIAN_CATEGORY_KEY_SEP}2025-01-${String(i + 1).padStart(2, "0")}${CARTESIAN_CATEGORY_KEY_SEP}销量`,
    );
    expect(resolveHierarchicalCategoryAxisRotate(dense, 180, "auto", 3)).toBeLessThan(0);
  });
});
