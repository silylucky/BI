import { buildPlanForType } from "@/components/charts/engine/plugins/plans/buildPlan";
import { BUILTIN_PLUGIN_DEFS } from "@/components/charts/engine/plugins/metadata";
import {
  getRegisteredChartPlugin,
  registerChartPlugin,
  registerChartPluginPackage,
} from "@/components/charts/engine/plugins/pluginStore";
import type { ChartViewPlugin } from "@/components/charts/engine/plugins/types";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { defaultGisProjectNativeBody } from "@/components/charts/engine/maplibre/gisProject";
import { chartStyleSectionsFromProfile } from "@/lib/chartTypeStyleProfiles";
import { createBarPluginPackage } from "@/components/charts/plugins/bar";

let registered = false;

/** 注册内置插件并同步 properties ← chartTypeStyleProfiles（G13） */
export function registerBuiltinChartPlugins(): void {
  if (registered) return;
  registered = true;

  registerChartPluginPackage(createBarPluginPackage());
  for (const def of BUILTIN_PLUGIN_DEFS) {
    if (def.type === "bar") continue;
    const plugin: ChartViewPlugin = {
      ...def,
      buildRenderPlan: (vm) => buildPlanForType(def.type, vm),
      setupDefaultConfig: (cfg) => ({
        ...cfg,
        chartType: def.type as ChartViewConfig["chartType"],
        styleVariant: "default",
        ...(def.type === "gis-map"
          ? { nativeBody: { ...cfg.nativeBody, ...defaultGisProjectNativeBody() } }
          : {}),
      }),
    };
    registerChartPlugin(plugin);
  }

  for (const def of BUILTIN_PLUGIN_DEFS) {
    const properties = chartStyleSectionsFromProfile(def.type as ChartViewConfig["chartType"]);
    def.properties = properties;
    const existing = getRegisteredChartPlugin(def.type);
    if (existing) {
      registerChartPlugin({ ...existing, properties });
    }
  }
}
