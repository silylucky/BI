/** GEO-IRON-01 共享常量（无运行时依赖，避免 geoMapChart ↔ OfflineGeoPort 循环引用） */

export const VS_REGIONS_MAP_ID = "vs-regions";

export const VS_GEO_MAP_PLACEHOLDER_FLAG = "__vsGeoMapPlaceholder";

export const VS_GEO_HEATMAP_PLACEHOLDER_FLAG = "__vsGeoHeatmapPlaceholder";

export const DEFAULT_GEO_MAP_PLACEHOLDER_HINT = "请拖入地理维度与指标";

export const DEFAULT_GEO_HEATMAP_PLACEHOLDER_HINT = "请拖入横轴、纵轴维度与指标";

export const MAP_REGION_NAME_HINT = "地理维度请使用省/市名称（如 regions.name）";

export function resolveEmbeddedGeoRoam(roam: boolean | undefined): boolean {
  return roam !== false;
}

export const GEO_MAP_SCALE_LIMIT = { min: 0.4, max: 4 } as const;

/** 离线地图资产加载 / 3D 首渲全链超时（毫秒） */
export const MAP_LOAD_TIMEOUT_MS = 12_000;

export function withMapLoadTimeout<T>(
  promise: Promise<T>,
  ms = MAP_LOAD_TIMEOUT_MS,
  message = "地图加载超时，请重试",
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
