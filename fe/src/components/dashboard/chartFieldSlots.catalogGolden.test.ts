import { describe, expect, it } from "vitest";
import "@/components/charts/engine/plugins/index";
import { BUILTIN_PLUGIN_DEFS } from "@/components/charts/engine/plugins/metadata";
import { getDeAxisBlueprint } from "@/lib/chartDeAxis";
import { chartDataSlotBlueprint } from "./chartFieldSlots";

const ACTIVE_TYPES = BUILTIN_PLUGIN_DEFS.filter((d) => !d.deprecated).map((d) => d.type);

const MIG_TYPES = BUILTIN_PLUGIN_DEFS.filter((d) => d.deprecated).map((d) => d.type);

describe("chartFieldSlots catalog golden (44 active + 5 MIG)", () => {
  it.each(ACTIVE_TYPES.map((t) => [t] as const))(
    "T-INSP-DE-GOLDEN %s: slot labels match DE catalog",
    (chartType) => {
      const expected = getDeAxisBlueprint(chartType).map((s) => s.label);
      expect(chartDataSlotBlueprint(chartType).map((s) => s.label)).toEqual(expected);
    },
  );

  it.each(MIG_TYPES.map((t) => [t] as const))(
    "T-INSP-DE-MIG %s: deprecated type slot labels match DE catalog",
    (chartType) => {
      const expected = getDeAxisBlueprint(chartType).map((s) => s.label);
      expect(chartDataSlotBlueprint(chartType).map((s) => s.label)).toEqual(expected);
    },
  );
});
