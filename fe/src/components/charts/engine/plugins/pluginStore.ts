import type { ChartViewPlugin, ChartPluginPackage } from "@/components/charts/engine/plugins/types";

const plugins = new Map<string, ChartViewPlugin>();
const packages = new Map<string, ChartPluginPackage>();

export function registerChartPlugin(plugin: ChartViewPlugin): void {
  plugins.set(plugin.type, plugin);
}

export function registerChartPluginPackage(pkg: ChartPluginPackage): void {
  packages.set(pkg.type, pkg);
  registerChartPlugin(pkg);
}

export function getRegisteredChartPlugin(type: string): ChartViewPlugin | undefined {
  return plugins.get(type);
}

export function listRegisteredChartPlugins(): ChartViewPlugin[] {
  return [...plugins.values()];
}

export function listRegisteredChartPluginTypes(): string[] {
  return [...plugins.keys()];
}

export function hasRegisteredChartPlugin(type: string): boolean {
  return plugins.has(type);
}

export function getRegisteredChartPluginPackage(type: string): ChartPluginPackage | undefined {
  return packages.get(type);
}

export function listRegisteredChartPluginPackages(): ChartPluginPackage[] {
  return [...packages.values()];
}
