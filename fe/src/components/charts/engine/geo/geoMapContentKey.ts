import type { ChartDrillFrame } from "@/lib/chartDrill";

export type GeoMapContentKeyInput = {
  chartType: string;
  mapId: string;
  drillDepth: number;
  drillStack: ChartDrillFrame[];
  rowCount: number;
  regionField?: string;
  rowsSample?: Record<string, unknown>[];
  depthVisual?: string;
  isDark?: boolean;
  renderTier?: string;
  geo3dStyleSig?: string;
  areaMappingSig?: string;
  /** 查询/定时刷新世代（executeKey） */
  dataRevision?: string;
};

/** 判断 3D 地图是否需要全量重建（数据/下钻/样式变更），尺寸变化走 resize。 */
export function buildGeoMapContentKey(input: GeoMapContentKeyInput): string {
  const drillSig = input.drillStack.map((f) => `${f.field}:${f.value}`).join("|");
  const rowSig =
    input.regionField && input.rowsSample?.length
      ? input.rowsSample
          .slice(0, 8)
          .map((r) => String(r[input.regionField!] ?? ""))
          .join(",")
      : "";
  return [
    input.dataRevision ?? "",
    input.chartType,
    input.mapId,
    input.drillDepth,
    drillSig,
    input.rowCount,
    rowSig,
    input.depthVisual ?? "off",
    input.isDark ? "dark" : "light",
    input.renderTier ?? "full",
    input.geo3dStyleSig ?? "",
    input.areaMappingSig ?? "",
  ].join("§");
}
