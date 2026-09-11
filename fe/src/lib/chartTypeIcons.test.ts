import { describe, expect, it } from "vitest";
import "@/components/charts/engine/plugins/index";
import { BUILTIN_PLUGIN_DEFS } from "@/components/charts/engine/plugins/metadata";
import { CHART_TYPE_ICONS, chartTypeIcon } from "./chartTypeIcons";

describe("chartTypeIcons", () => {
  it("each active chart type has a dedicated icon entry", () => {
    for (const def of BUILTIN_PLUGIN_DEFS) {
      if (def.deprecated) continue;
      expect(CHART_TYPE_ICONS[def.type], def.type).toBeDefined();
      expect(chartTypeIcon(def.type)).toBe(CHART_TYPE_ICONS[def.type]);
    }
  });
});
