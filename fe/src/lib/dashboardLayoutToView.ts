import type { DashboardLayout } from "@/components/dashboard/layoutUtils";

export type DashboardViewDocument = {
  name: string;
  protocolVersion: 1;
  dashboardId: string;
  layout: DashboardLayout;
};

/**
 * Adapt dashboard storage to the FR-VIEW-1 envelope.
 * The envelope version is independent from layout.version; preserve v1/v2 layout geometry verbatim.
 */
export function dashboardLayoutToView(params: {
  dashboardId: string;
  name: string;
  layoutJson: DashboardLayout;
}): DashboardViewDocument {
  return {
    name: params.name,
    protocolVersion: 1,
    dashboardId: params.dashboardId,
    layout: params.layoutJson,
  };
}
