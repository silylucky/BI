import { DEFAULT_GEO_MAP_PLACEHOLDER_HINT } from "@/components/charts/engine/geoEnginePort";
import { GeoMapPlaceholderView } from "@/components/charts/engine/geo/GeoMapPlaceholderView";

type Props = {
  hint?: string;
  isDark?: boolean;
  fill?: boolean;
  height?: number;
  className?: string;
  "data-testid"?: string;
};

/** 未配置 / 无数据时的中国地图轮廓占位（对标 DataEase 图案地图） */
export function GeoMapPlaceholderChart({
  hint = DEFAULT_GEO_MAP_PLACEHOLDER_HINT,
  ...rest
}: Props) {
  return <GeoMapPlaceholderView hint={hint} {...rest} />;
}
