import { memo } from "react";
import { cn } from "@/lib/utils";
import { DEFAULT_GEO_MAP_PLACEHOLDER_HINT } from "@/components/charts/engine/geo/geoConstants";

type Props = {
  hint?: string;
  fill?: boolean;
  height?: number;
  className?: string;
  "data-testid"?: string;
};

/** 未配置时的中国地图轮廓占位（对标 DataEase 图案地图） */
function GeoMapPlaceholderViewInner({
  hint = DEFAULT_GEO_MAP_PLACEHOLDER_HINT,
  fill = false,
  height = 180,
  className,
  "data-testid": testId = "geo-map-placeholder",
}: Props) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center bg-gray-50 dark:bg-gray-900/40",
        fill ? "absolute inset-0 min-h-0" : "min-h-[180px] w-full",
        className,
      )}
      data-testid={testId}
      style={fill ? undefined : { height }}
      role="img"
      aria-label={hint}
    >
      <p className="px-4 text-center text-theme-sm text-gray-500 dark:text-gray-400">{hint}</p>
    </div>
  );
}

export const GeoMapPlaceholderView = memo(GeoMapPlaceholderViewInner);
