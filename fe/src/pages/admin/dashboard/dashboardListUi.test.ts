import { describe, expect, it } from "vitest";
import { filterDashboardSurfaceListItems } from "./dashboardListUi";

describe("filterDashboardSurfaceListItems", () => {
  const items = [
    { id: "1", name: "财政收支概览", slug: "finance-overview", description: "demo" },
    { id: "2", name: "运营看板", slug: "ops-dashboard", description: null },
  ];

  it("returns all items when query is blank", () => {
    expect(filterDashboardSurfaceListItems(items, "   ")).toEqual(items);
  });

  it("matches name, slug, and description case-insensitively", () => {
    expect(filterDashboardSurfaceListItems(items, "财政").map((item) => item.id)).toEqual(["1"]);
    expect(filterDashboardSurfaceListItems(items, "OPS").map((item) => item.id)).toEqual(["2"]);
    expect(filterDashboardSurfaceListItems(items, "demo").map((item) => item.id)).toEqual(["1"]);
  });
});
