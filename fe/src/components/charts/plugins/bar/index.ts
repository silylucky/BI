import type { ChartPluginPackage } from "@/components/charts/engine/plugins/types";
import { buildPlanForType } from "@/components/charts/engine/plugins/plans/buildPlan";
import { BUILTIN_PLUGIN_DEFS } from "@/components/charts/engine/plugins/metadata";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { chartStyleSectionsFromProfile } from "@/lib/chartTypeStyleProfiles";
import { BarPluginDemo } from "./BarPluginDemo";

/** 示例：单包闭环插件（bar）；其余类型仍由 metadata 批量注册，可逐步迁移至此目录结构。 */
export function createBarPluginPackage(): ChartPluginPackage {
  const def = BUILTIN_PLUGIN_DEFS.find((d) => d.type === "bar")!;
  return {
    ...def,
    buildRenderPlan: (vm) => buildPlanForType("bar", vm),
    setupDefaultConfig: (cfg) => ({
      ...cfg,
      chartType: "bar" as ChartViewConfig["chartType"],
      styleVariant: "default",
    }),
    inspector: { styleSections: chartStyleSectionsFromProfile("bar") },
    demo: BarPluginDemo,
  };
}
