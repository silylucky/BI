import { describe, expect, it } from "vitest";
import {
  assertCatalogSmokeCoverage,
  CHART_CATALOG_SMOKE_CASES,
} from "./chartCatalogSmokeFixtures";

describe("chartCatalogSmokeFixtures", () => {
  it("covers every non-deprecated catalog type exactly once", () => {
    expect(() => assertCatalogSmokeCoverage()).not.toThrow();
    expect(CHART_CATALOG_SMOKE_CASES).toHaveLength(44);
    const types = CHART_CATALOG_SMOKE_CASES.map((c) => c.type);
    expect(new Set(types).size).toBe(types.length);
  });
});
