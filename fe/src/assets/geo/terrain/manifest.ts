/** 自动生成：pnpm run build:geo-terrain */

export const CHINA_TERRAIN_NATIONAL_ID = "national" as const;

export const CHINA_TERRAIN_BOUNDS = {
  west: 72.27048869999999,
  south: 2.82878928,
  east: 136.32753630000002,
  north: 54.558062719999995,
} as const;

export const CHINA_TERRAIN_PROVINCE_ADCODES = [
  110000,
  120000,
  130000,
  140000,
  150000,
  210000,
  220000,
  230000,
  310000,
  320000,
  330000,
  340000,
  350000,
  360000,
  370000,
  410000,
  420000,
  430000,
  440000,
  450000,
  460000,
  500000,
  510000,
  520000,
  530000,
  540000,
  610000,
  620000,
  630000,
  640000,
  650000,
  710000,
  810000,
  820000,
] as const;

export type ChinaTerrainProvinceAdcode = (typeof CHINA_TERRAIN_PROVINCE_ADCODES)[number];
