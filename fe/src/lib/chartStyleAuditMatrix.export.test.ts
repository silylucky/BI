/**
 * One-shot export for truth-audit §3d matrix (run: npx vitest run src/lib/chartStyleAuditMatrix.export.test.ts)
 */
import { describe, it } from "vitest";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildFullAuditMatrix } from "@/lib/chartStyleAuditMatrix";
import { BUILTIN_PLUGIN_DEFS } from "@/components/charts/engine/plugins/metadata";
import { chartHasAdvancedTab } from "@/lib/chartInspectorCapabilities";
import { chartStyleSectionsFromProfile } from "@/lib/chartTypeStyleProfiles";
import type { ChartType } from "@/lib/chartViewConfig";

const ACTIVE = BUILTIN_PLUGIN_DEFS.filter((d) => !d.deprecated).map((d) => d.type);

describe("export audit matrix", () => {
  it("writes §3d JSON", () => {
    const rows = buildFullAuditMatrix();
    const chartRows = ACTIVE.flatMap((type) => {
      const sections = chartStyleSectionsFromProfile(type as ChartType);
      const adv = chartHasAdvancedTab(type as ChartType);
      return [
        { surface: "S1", entityId: type, configTab: "data", gate: "GATE", sections: [] },
        {
          surface: "S1",
          entityId: type,
          configTab: "style",
          gate: "GATE",
          sections,
        },
        {
          surface: "S1",
          entityId: type,
          configTab: adv ? "advanced" : "advanced-out",
          gate: adv ? "GATE" : "OUT",
          sections: [],
        },
      ];
    });
    const out = {
      generatedAt: "2026-08-03",
      activeChartTypes: ACTIVE,
      activeCount: ACTIVE.length,
      matrixRows: rows.length,
      s1ChartTabRows: chartRows.length,
      chartRows,
      fullMatrix: rows,
    };
    const path = resolve(__dirname, "../../../docs/feature-truth/_generated-2026-08-03-matrix.json");
    writeFileSync(path, JSON.stringify(out, null, 2), "utf8");
    console.log(`Wrote ${path} (${ACTIVE.length} types, ${chartRows.length} S1 tab rows)`);
  });
});
