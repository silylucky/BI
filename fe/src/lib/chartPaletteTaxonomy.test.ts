import { describe, expect, it } from "vitest";
import { buildDeStylePaletteSections } from "./chartPaletteTaxonomy";
import { FALLBACK_CATALOG_ITEMS } from "./chartTypeCatalogDisplay";

describe("chartPaletteTaxonomy", () => {
  it("groups fallback catalog into DE-style section labels", () => {
    const sections = buildDeStylePaletteSections(FALLBACK_CATALOG_ITEMS);
    const labels = sections.map((s) => s.label);
    expect(labels).toContain("线/面图");
    expect(labels).toContain("柱/条图");
    expect(labels).toContain("分布图");
    const lineSection = sections.find((s) => s.label === "线/面图");
    expect(lineSection?.items.some((i) => i.type === "line")).toBe(true);
  });
});
