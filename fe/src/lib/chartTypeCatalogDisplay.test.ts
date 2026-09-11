import { describe, expect, it } from "vitest";
import {
  FALLBACK_CATALOG_ITEMS,
  groupCatalogItemsByCategory,
} from "./chartTypeCatalogDisplay";

describe("chartTypeCatalogDisplay", () => {
  it("T-VIZ-PALETTE-01: fallback catalog covers 12 builtin types", () => {
    expect(FALLBACK_CATALOG_ITEMS).toHaveLength(12);
    expect(FALLBACK_CATALOG_ITEMS.map((i) => i.type)).toContain("pie");
    expect(FALLBACK_CATALOG_ITEMS.map((i) => i.type)).toContain("gauge");
    expect(FALLBACK_CATALOG_ITEMS.map((i) => i.type)).toContain("sankey");
  });

  it("T-VIZ-PALETTE-02: groupCatalogItemsByCategory preserves all items", () => {
    const groups = groupCatalogItemsByCategory(FALLBACK_CATALOG_ITEMS);
    const flattened = groups.flatMap((g) => g.items);
    expect(flattened).toHaveLength(12);
    expect(groups[0]?.label).toBe("基础");
    expect(groups.some((g) => g.label === "流向" && g.items.some((i) => i.type === "funnel"))).toBe(
      true,
    );
  });
});
