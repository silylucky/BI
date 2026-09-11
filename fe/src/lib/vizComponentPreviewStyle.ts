import { bootstrapDashboardStyleConfig } from "@/components/dashboard/dashboardThemeVariants";
import type { DashboardStyleConfig } from "@/components/dashboard/dashboardStyleConfig";

/** 组件库 Hub / 编辑页预览与看板默认浅色主题对齐，customViz 继承同一套 palette/chrome。 */
export function vizComponentPreviewDashboardStyle(): DashboardStyleConfig {
  return bootstrapDashboardStyleConfig({ colorScheme: "light" });
}
