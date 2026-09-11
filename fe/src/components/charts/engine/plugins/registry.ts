import type { ChartViewPlugin, ChartPluginPackage } from "@/components/charts/engine/plugins/types";
import {
  getRegisteredChartPlugin,
  hasRegisteredChartPlugin,
  listRegisteredChartPluginPackages,
  listRegisteredChartPluginTypes,
  listRegisteredChartPlugins,
  registerChartPlugin,
  registerChartPluginPackage,
  getRegisteredChartPluginPackage,
} from "@/components/charts/engine/plugins/pluginStore";
import { registerBuiltinChartPlugins } from "@/components/charts/engine/plugins/register";

export {
  registerChartPlugin,
  registerChartPluginPackage,
} from "@/components/charts/engine/plugins/pluginStore";

let booted = false;

function ensurePluginsBooted(): void {
  if (booted) return;
  registerBuiltinChartPlugins();
  booted = true;
}

export function getChartPlugin(type: string): ChartViewPlugin | undefined {
  ensurePluginsBooted();
  return getRegisteredChartPlugin(type);
}

export function listChartPlugins(): ChartViewPlugin[] {
  ensurePluginsBooted();
  return listRegisteredChartPlugins();
}

export function listChartPluginTypes(): string[] {
  ensurePluginsBooted();
  return listRegisteredChartPluginTypes();
}

export function hasChartPlugin(type: string): boolean {
  ensurePluginsBooted();
  return hasRegisteredChartPlugin(type);
}

export function getChartPluginPackage(type: string): ChartPluginPackage | undefined {
  ensurePluginsBooted();
  return getRegisteredChartPluginPackage(type);
}

export function listChartPluginPackages(): ChartPluginPackage[] {
  ensurePluginsBooted();
  return listRegisteredChartPluginPackages();
}
