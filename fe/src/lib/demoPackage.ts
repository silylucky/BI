/** 官方演示包 UI 辅助（对标 DataEase 示例数据源 / 示例看板） */

import type { DashboardLayout } from "@/components/dashboard/layoutUtils";
import type { DemoPackageLayoutMeta } from "@/components/dashboard/dashboardLayoutContracts";

const OFFICIAL_DEMO_SLUG_PREFIXES = ["官方示例", "demo-"] as const;

export function isDemoPackageDatasource(code: string | undefined | null): boolean {
  return (code ?? "").toLowerCase() === "demo";
}

export function isProtectedDemoDatasource(input: {
  code?: string | null;
  isDemoPackage?: boolean;
}): boolean {
  return isDemoPackageDatasource(input.code) || Boolean(input.isDemoPackage);
}

export function isOfficialDemoSlug(slug: string): boolean {
  return OFFICIAL_DEMO_SLUG_PREFIXES.some((prefix) => slug.startsWith(prefix));
}

export function readDemoPackageMeta(layout: DashboardLayout | undefined): DemoPackageLayoutMeta | null {
  const meta = layout?.demoPackage;
  return meta?.seed ? meta : null;
}

export function isDemoPackageDataset(datasetId: string, displayName?: string | null): boolean {
  if ((datasetId ?? "").toLowerCase().startsWith("demo-")) return true;
  return (displayName ?? "").startsWith("【官方示例】");
}

export function isDemoPackageDashboard(input: {
  slug: string;
  layoutJson?: DashboardLayout;
}): boolean {
  if (isOfficialDemoSlug(input.slug)) return true;
  return Boolean(readDemoPackageMeta(input.layoutJson)?.seed);
}

/** 列表卡片是否在标题外额外展示「官方示例」徽章（标题已含则不再重复） */
export function shouldShowOfficialDemoBadge(input: {
  slug: string;
  name: string;
  layoutJson?: DashboardLayout;
}): boolean {
  if (!isDemoPackageDashboard({ slug: input.slug, layoutJson: input.layoutJson })) {
    return false;
  }
  return !input.name.includes("官方示例");
}
