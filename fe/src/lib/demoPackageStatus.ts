import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export type DemoPackageStatus = {
  ready: boolean;
  mysqlReachable: boolean;
  schemaVersion: number;
  datasourceId: string | null;
  datasourceCode: string;
  demoDashboardIds: string[];
  demoDatasetIds: string[];
  message: string | null;
};

export async function fetchDemoPackageStatus(refresh = false): Promise<DemoPackageStatus> {
  const qs = refresh ? "?refresh=true" : "";
  return apiFetch<DemoPackageStatus>(`/api/v1/demo-package/status${qs}`);
}

export const demoPackageStatusQueryKey = queryKeys.demoPackage.status;
