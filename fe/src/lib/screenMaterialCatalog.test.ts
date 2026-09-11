import { describe, expect, it } from "vitest";
import {
  SCREEN_MATERIAL_CATALOG,
  getScreenMaterialByCategory,
  getScreenMaterialCatalogItem,
} from "./screenMaterialCatalog";

describe("screenMaterialCatalog", () => {
  it("lists border, shape and icon categories", () => {
    expect(getScreenMaterialByCategory("border")).toHaveLength(9);
    expect(getScreenMaterialByCategory("shape")).toHaveLength(3);
    expect(getScreenMaterialByCategory("icon").length).toBeGreaterThan(30);
    expect(SCREEN_MATERIAL_CATALOG.length).toBe(9 + 3 + getScreenMaterialByCategory("icon").length);
  });

  it("resolves catalog item by id", () => {
    expect(getScreenMaterialCatalogItem("border-1")?.label).toBe("边框1");
    expect(getScreenMaterialCatalogItem("shape-rect")?.payload).toEqual({
      insert: "screen-shape",
      preset: "rect",
    });
    expect(getScreenMaterialCatalogItem("icon-star")?.label).toBe("星标");
    expect(getScreenMaterialCatalogItem("icon-star")?.payload).toEqual({
      insert: "screen-icon",
      preset: "star",
    });
  });
});
