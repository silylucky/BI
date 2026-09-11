import { describe, expect, it } from "vitest";
import {
  buildDashboardNameCounts,
  dashboardPickerPrimaryLabel,
  matchesDashboardPickerQuery,
} from "./dashboardPickerDisplay";

describe("dashboardPickerDisplay", () => {
  const items = [
    { id: "aaaaaaaa-1111", name: "未命名看板", updatedAt: "2026-07-01T10:00:00Z" },
    { id: "bbbbbbbb-2222", name: "未命名看板", updatedAt: "2026-07-02T10:00:00Z" },
    { id: "cccccccc-3333", name: "销售看板", updatedAt: "2026-07-03T10:00:00Z" },
  ];

  it("disambiguates duplicate dashboard names with short id", () => {
    const counts = buildDashboardNameCounts(items);
    expect(dashboardPickerPrimaryLabel(items[0], counts)).toBe("未命名看板 · aaaaaaaa…");
    expect(dashboardPickerPrimaryLabel(items[2], counts)).toBe("销售看板");
  });

  it("matches search by id and Chinese name", () => {
    expect(matchesDashboardPickerQuery(items[1], "bbbbbbbb")).toBe(true);
    expect(matchesDashboardPickerQuery(items[2], "销售")).toBe(true);
    expect(
      matchesDashboardPickerQuery(
        { id: "d2", name: "运营看板", slug: "ops", updatedAt: "2026-07-02T10:00:00Z" },
        "运营",
      ),
    ).toBe(true);
    expect(matchesDashboardPickerQuery(items[0], "运营")).toBe(false);
  });
});
