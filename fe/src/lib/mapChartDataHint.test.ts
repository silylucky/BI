import { describe, expect, it } from "vitest";
import { SALES_GEO_DRILL_SQL, mapChartFieldHint } from "./mapChartDataHint";

describe("mapChartFieldHint", () => {
  it("suggests drill sql for demo sales region_id columns", () => {
    const hint = mapChartFieldHint(["sale_date", "region_id", "amount"]);
    expect(hint?.message).toContain("5–10");
    expect(hint?.sampleSql).toBe(SALES_GEO_DRILL_SQL);
  });

  it("returns null when geo name column exists", () => {
    expect(mapChartFieldHint(["region", "amount"])).toBeNull();
  });

  it("hides sql when province and city are configured", () => {
    const hint = mapChartFieldHint(["province", "city", "total"]);
    expect(hint?.sampleSql).toBeNull();
  });
});

describe("SALES_GEO_DRILL_SQL", () => {
  it("groups demo sales by province city district", () => {
    expect(SALES_GEO_DRILL_SQL).toContain("v_sales_geo");
    expect(SALES_GEO_DRILL_SQL).toContain("district");
  });
});
