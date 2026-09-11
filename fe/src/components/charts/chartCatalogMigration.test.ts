import { describe, expect, it } from "vitest";
import "@/components/charts/engine/plugins/index";
import { BUILTIN_PLUGIN_DEFS } from "@/components/charts/engine/plugins/metadata";
import { migrateChartViewConfig } from "@/lib/migrateChartTypes";

const DEPRECATED = BUILTIN_PLUGIN_DEFS.filter((d) => d.deprecated);

describe("chart catalog MIG (deprecated → migratesTo)", () => {
  it("T-VIZ-R33-001: every deprecated type declares migratesTo", () => {
    expect(DEPRECATED.length).toBeGreaterThanOrEqual(5);
    for (const def of DEPRECATED) {
      expect(def.migratesTo, def.type).toBeTruthy();
    }
  });

  it.each(DEPRECATED.map((d) => [d.type, d.migratesTo!] as const))(
    "T-VIZ-R33-002 %s migrates to %s",
    (from, to) => {
      const next = migrateChartViewConfig({ chartType: from });
      expect(next.chartType).toBe(to);
    },
  );
});
