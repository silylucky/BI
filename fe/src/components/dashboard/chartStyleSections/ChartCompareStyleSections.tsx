import { Switch } from "@/components/ui/switch";
import { useChartInspector } from "../ChartInspectorContext";
import {
  ChartInspectorSection,
  INSPECTOR_SECTION_GAP,
  INSPECTOR_SWITCH_SIZE,
  InspectorInlineColorRow,
  InspectorSwitchRow,
} from "../inspectorCompact";
import { ChartDeSliderField } from "../deAttrSlider";
import { patchChartDeStyleNested, readChartDeStyle } from "@/lib/chartDeStyle";

export function ChartQuadrantShapeSection() {
  const { cfg, mutateChartConfig } = useChartInspector();
  const quadrant = readChartDeStyle(cfg).quadrant ?? {};
  const patch = (p: Record<string, unknown>) =>
    mutateChartConfig((c) => patchChartDeStyleNested(c, "quadrant", p));

  return (
    <ChartInspectorSection title="象限样式" data-testid="chart-quadrant-shape">
      <div className={INSPECTOR_SECTION_GAP}>
        <InspectorInlineColorRow
          label="分割线颜色"
          value={quadrant.lineColor ?? ""}
          fallbackValue="#64748b"
          onChange={(lineColor) => patch({ lineColor })}
        />
        <ChartDeSliderField label="线宽" value={quadrant.lineWidth} fallback={1.5} min={1} max={4} step={0.5} onChange={(lineWidth) => patch({ lineWidth })} />
        <InspectorSwitchRow
          label="象限区域底色"
          checked={quadrant.showRegionBg !== false}
          onCheckedChange={(showRegionBg) => patch({ showRegionBg })}
        />
        <ChartDeSliderField label="区域透明度" value={quadrant.regionOpacity} fallback={0.1} min={0.05} max={0.35} step={0.05} onChange={(regionOpacity) => patch({ regionOpacity })} />
      </div>
    </ChartInspectorSection>
  );
}

export function ChartProgressBarShapeSection() {
  const { cfg, mutateChartConfig } = useChartInspector();
  const progressBar = readChartDeStyle(cfg).progressBar ?? {};
  const patch = (p: Record<string, unknown>) =>
    mutateChartConfig((c) => patchChartDeStyleNested(c, "progressBar", p));

  return (
    <ChartInspectorSection title="进度条样式" data-testid="chart-progress-bar-shape">
      <ChartDeSliderField label="轨道透明度" value={progressBar.trackOpacity} fallback={0.35} min={0.1} max={0.8} step={0.05} onChange={(trackOpacity) => patch({ trackOpacity })} />
    </ChartInspectorSection>
  );
}

export function ChartBulletShapeSection() {
  const { cfg, mutateChartConfig } = useChartInspector();
  const bullet = readChartDeStyle(cfg).bullet ?? {};
  const patch = (p: Record<string, unknown>) =>
    mutateChartConfig((c) => patchChartDeStyleNested(c, "bullet", p));

  return (
    <ChartInspectorSection title="子弹图样式" data-testid="chart-bullet-shape">
      <div className={INSPECTOR_SECTION_GAP}>
        <ChartDeSliderField label="目标线宽度" value={bullet.targetLineWidth} fallback={2} min={1} max={6} step={0.5} onChange={(targetLineWidth) => patch({ targetLineWidth })} />
        <ChartDeSliderField label="区间透明度" value={bullet.rangeOpacity} fallback={0.85} min={0.3} max={1} step={0.05} onChange={(rangeOpacity) => patch({ rangeOpacity })} />
      </div>
    </ChartInspectorSection>
  );
}

export function ChartStockLineShapeSection() {
  const { cfg, mutateChartConfig } = useChartInspector();
  const stockLine = readChartDeStyle(cfg).stockLine ?? {};
  const patch = (p: Record<string, unknown>) =>
    mutateChartConfig((c) => patchChartDeStyleNested(c, "stockLine", p));

  return (
    <ChartInspectorSection title="K 线样式" data-testid="chart-stock-line-shape">
      <ChartDeSliderField label="实体宽度比" value={stockLine.bodyWidthRatio} fallback={0.6} min={0.2} max={0.9} step={0.05} onChange={(bodyWidthRatio) => patch({ bodyWidthRatio })} />
    </ChartInspectorSection>
  );
}
