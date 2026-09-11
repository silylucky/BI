import { describe, expect, it } from "vitest";
import { registerBuiltinChartPlugins } from "@/components/charts/engine/plugins/register";
import { BUILTIN_PLUGIN_DEFS } from "@/components/charts/engine/plugins/metadata";
import { getChartPlugin, listChartPluginTypes } from "@/components/charts/engine/plugins/registry";
import { chartStyleSectionsFromProfile } from "@/lib/chartTypeStyleProfiles";
import type { ChartType } from "@/lib/chartViewConfig";

const EXPECTED_CHART_TYPE_COUNT = 50;

describe("chart catalog parity (FE registry ↔ metadata)", () => {
  registerBuiltinChartPlugins();

  it("registers all builtin plugin defs", () => {
    expect(BUILTIN_PLUGIN_DEFS.length).toBe(EXPECTED_CHART_TYPE_COUNT);
    expect(listChartPluginTypes().length).toBe(EXPECTED_CHART_TYPE_COUNT);
    const registered = listChartPluginTypes().sort();
    const defined = BUILTIN_PLUGIN_DEFS.map((def) => def.type).sort();
    expect(registered).toEqual(defined);
  });

  it("each plugin exposes DE library and paletteCategory", () => {
    for (const def of BUILTIN_PLUGIN_DEFS) {
      const plugin = getChartPlugin(def.type);
      expect(plugin, def.type).toBeDefined();
      expect(plugin?.library).toBe(def.library);
      expect(plugin?.paletteCategory).toBe(def.paletteCategory);
      expect(plugin?.renderer).toBe(def.renderer);
      if (def.deprecated) {
        expect(plugin?.deprecated).toBe(true);
        expect(plugin?.migratesTo).toBe(def.migratesTo);
      }
    }
  });

  it("deprecated types declare migratesTo targets that exist", () => {
    const types = new Set(BUILTIN_PLUGIN_DEFS.map((def) => def.type));
    for (const def of BUILTIN_PLUGIN_DEFS) {
      if (!def.migratesTo) continue;
      expect(types.has(def.migratesTo), `${def.type} → ${def.migratesTo}`).toBe(true);
    }
  });

  it("plugin.properties mirrors chartTypeStyleProfiles (G13)", () => {
    for (const def of BUILTIN_PLUGIN_DEFS) {
      const plugin = getChartPlugin(def.type);
      const fromProfile = chartStyleSectionsFromProfile(def.type as ChartType);
      expect(plugin?.properties, def.type).toEqual(fromProfile);
      expect(def.properties, def.type).toEqual(fromProfile);
    }
  });
});
