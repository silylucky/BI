/** GeoLibre / Leonel Dias 大气光晕参数 — https://leoneljdias.github.io/posts/globe-atmosphere-halo-comets/ */

export const GEOLIBRE_HALO_OUTER_SCALE = 2.8;
/** GeoLibre 面板默认光晕范围约 2.75x。 */
export const GEOLIBRE_HALO_RANGE_DEFAULT = 2.75;
/** GeoLibre 默认光晕主色。 */
export const DEFAULT_GIS_HALO_COLOR = "#c8ebff";
/** 内缘略小于球缘，让亮边与地球 rim 重叠消 seam（GeoLibre #230）。 */
export const GEOLIBRE_HALO_PUNCH_INSET = 0.965;

export type HaloColorStop = [position: number, color: string];

/** 与 GeoLibre 默认深空光晕一致。 */
export const GEOLIBRE_HALO_STOPS_NIGHT: HaloColorStop[] = [
  [0.0, "rgba(200, 235, 255, 1.0)"],
  [0.03, "rgba(130, 200, 250, 0.6)"],
  [0.08, "rgba(70, 150, 230, 0.35)"],
  [0.18, "rgba(40, 100, 200, 0.15)"],
  [0.35, "rgba(25, 65, 160, 0.06)"],
  [0.6, "rgba(15, 40, 110, 0.02)"],
  [1.0, "rgba(10, 25, 70, 0.0)"],
];

export const GEOLIBRE_HALO_STOPS_DAY: HaloColorStop[] = [
  [0.0, "rgba(235, 248, 255, 0.95)"],
  [0.03, "rgba(190, 225, 255, 0.55)"],
  [0.08, "rgba(140, 200, 250, 0.3)"],
  [0.18, "rgba(90, 160, 235, 0.14)"],
  [0.35, "rgba(55, 120, 210, 0.06)"],
  [0.6, "rgba(35, 85, 170, 0.02)"],
  [1.0, "rgba(20, 50, 120, 0.0)"],
];
