import { ChartPalettePicker } from "./ChartPalettePicker";
import { ChartDeSliderField } from "./deAttrSlider";
import { cn } from "@/lib/utils";

import type { ChartSeriesColorItem } from "@/lib/chartDeStyle";

type ChartPaletteConfigFieldsProps = {
  paletteId?: string;
  paletteColors?: readonly string[];
  seriesColors?: readonly ChartSeriesColorItem[];
  onPaletteChange: (paletteId: string | undefined, colors: readonly string[]) => void;
  onSeriesColorsChange?: (items: readonly ChartSeriesColorItem[]) => void;
  onOpacityChange?: (opacity: number) => void;
  /** 拖拽滑块时实时预览（对标 DE 配色不透明度即时反馈） */
  onOpacityPreview?: (opacity: number) => void;
  /** 组件级：可选继承仪表板配色（首项「默认」） */
  showInherit?: boolean;
  inheritPreviewColors?: readonly string[];
  /** 216px 图表栏等窄容器 */
  dense?: boolean;
  /** 不透明度滑块布局；饼图基础样式等窄栏建议 stacked 全宽 */
  opacitySliderLayout?: "stacked" | "inline";
  className?: string;
};

/** 看板 / 组件共用的配色方案区块（选择器 + 可选不透明度） */
export function ChartPaletteConfigFields({
  paletteId,
  paletteColors,
  paletteOpacity,
  seriesColors,
  onPaletteChange,
  onSeriesColorsChange,
  onOpacityChange,
  onOpacityPreview,
  showInherit = false,
  inheritPreviewColors,
  dense = false,
  opacitySliderLayout,
  className,
}: ChartPaletteConfigFieldsProps) {
  const pickerValue = showInherit ? paletteId : paletteId ?? "default";
  const sliderLayout = opacitySliderLayout ?? (dense ? "inline" : "stacked");

  return (
    <div className={cn("space-y-2.5", className)}>
      <ChartPalettePicker
        showInherit={showInherit}
        dense={dense}
        value={pickerValue}
        paletteColors={paletteColors}
        seriesColors={seriesColors}
        inheritPreviewColors={inheritPreviewColors}
        onChange={onPaletteChange}
        onSeriesColorsChange={onSeriesColorsChange}
      />
      {onOpacityChange ? (
        <div className="space-y-1">
          <ChartDeSliderField
            label="配色不透明度"
            layout={sliderLayout}
            value={
              paletteOpacity != null ? Math.round(paletteOpacity * 100) : undefined
            }
            fallback={100}
            min={0}
            max={100}
            step={1}
            unit="%"
            ariaLabel="配色不透明度"
            onChange={onOpacityChange}
            onPreviewChange={
              onOpacityPreview
                ? (value) => {
                    if (value != null) onOpacityPreview(value);
                  }
                : undefined
            }
          />
        </div>
      ) : null}
    </div>
  );
}
