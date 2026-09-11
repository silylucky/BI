import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TEXT_COLOR_RECOMMENDED, WIDGET_BORDER_RECOMMENDED } from "@/components/dashboard/dashboardStyleConfig";
import { ChartPaletteDeParityFields } from "../chartPaletteDeParityFields";
import { useChartInspector } from "../ChartInspectorContext";
import {
  ChartInspectorSection,
  INSPECTOR_SECTION_GAP,
  INSPECTOR_SELECT,
  INSPECTOR_SWITCH_SIZE,
  InspectorInlineColorRow,
  InspectorSwitchRow,
} from "../inspectorCompact";
import { ChartDeSegmentField } from "../chartInspectorDeFields";
import { ChartDeSliderField } from "../deAttrSlider";
import {
  DEFAULT_PIE_INNER_RADIUS_PERCENT,
  DEFAULT_PIE_MERGE_TOP_N,
  patchChartDeStyleNested,
  PIE_INNER_RADIUS_MAX,
  PIE_INNER_RADIUS_MIN,
  readChartDeStyle,
  resolveChartTooltipDisplayBackground,
  resolveChartTooltipDisplayColor,
  resolveEffectivePaletteId,
  patchChartPaletteDeStyle,
} from "@/lib/chartDeStyle";
import {
  DEFAULT_CIRCLE_PACKING_SIZE_PERCENT,
  DEFAULT_LIQUID_SIZE,
  DEFAULT_PIE_OUTER_RADIUS_PERCENT,
  DEFAULT_RADAR_RADIUS_PERCENT,
  DEFAULT_TREEMAP_CELL_RADIUS,
  DEFAULT_TREEMAP_PADDING_INNER,
  DEFAULT_TREEMAP_PADDING_OUTER,
  RADAR_RADIUS_PERCENT_MAX,
  RADAR_RADIUS_PERCENT_MIN,
} from "@/lib/chartDeStyleBlocks";
import { resolveChartSeriesColorItems, supportsChartSeriesColorEditing } from "@/lib/chartSeriesColor";

function patchBlock<K extends "pie" | "gauge" | "liquid" | "kpi" | "funnel" | "sankey" | "graph" | "radar" | "wordCloud" | "treemap" | "circlePacking">(
  cfg: Parameters<typeof patchChartDeStyleNested>[0],
  key: K,
  patch: Record<string, unknown>,
) {
  return patchChartDeStyleNested(cfg, key, patch);
}

export function ChartPieShapeSection() {
  const { cfg, patchDeStyle, mutateChartConfig, dashboardStyle } = useChartInspector();
  const deStyle = readChartDeStyle(cfg);
  const pie = deStyle.pie ?? {};
  const mergeOthers = pie.mergeOthers === true;
  const isDonut =
    cfg.chartType === "pie-donut" || cfg.chartType === "pie-donut-rose";
  const patch = (p: Record<string, unknown>) =>
    mutateChartConfig((c) => patchChartDeStyleNested(c, "pie", p));

  const seriesColorItems = supportsChartSeriesColorEditing(cfg.chartType)
    ? resolveChartSeriesColorItems(
        cfg,
        resolveEffectivePaletteId(cfg, dashboardStyle?.paletteId),
        deStyle.seriesColor,
        deStyle.paletteId != null ? deStyle.paletteColors : dashboardStyle?.paletteColors,
      )
    : [];

  const patchPaletteOpacity = (opacityPercent: number) =>
    patchDeStyle({ paletteOpacity: opacityPercent / 100 });

  return (
    <ChartInspectorSection title="基础样式" data-testid="chart-pie-shape">
      <div className={INSPECTOR_SECTION_GAP}>
        <ChartPaletteDeParityFields
          dense
          opacitySliderLayout="stacked"
          showInherit
          dashboardPaletteId={dashboardStyle?.paletteId}
          dashboardPaletteColors={dashboardStyle?.paletteColors}
          paletteId={deStyle.paletteId}
          paletteColors={deStyle.paletteColors}
          seriesColor={seriesColorItems.length > 0 ? seriesColorItems : undefined}
          paletteOpacity={deStyle.paletteOpacity}
          showLabelToggle={false}
          showTooltipToggle={false}
          showGradientToggle={false}
          showDepthToggle={false}
          showOpacity
          onPaletteChange={(paletteId, colors) =>
            mutateChartConfig((current) => patchChartPaletteDeStyle(current, paletteId, colors))
          }
          onSeriesColorsChange={(items) =>
            patchDeStyle({ seriesColor: items.length > 0 ? [...items] : undefined })
          }
          onOpacityChange={patchPaletteOpacity}
          onOpacityPreview={patchPaletteOpacity}
        />
        <InspectorSwitchRow
          label="合并数据"
          hint="显示 Top N，其余合并为一项"
          checked={mergeOthers}
          onCheckedChange={(checked) =>
            patch({
              mergeOthers: checked,
              ...(checked && pie.topN == null ? { topN: DEFAULT_PIE_MERGE_TOP_N } : {}),
            })
          }
        />
        {mergeOthers ? (
          <div className="mt-2">
              <ChartDeSliderField
                label="显示 Top"
                value={pie.topN}
                fallback={DEFAULT_PIE_MERGE_TOP_N}
                min={3}
                max={50}
                step={1}
                onChange={(topN) => patch({ topN })}
              />
            </div>
          ) : null}
        <ChartDeSliderField
          label="外径"
          value={pie.outerRadiusPercent}
          fallback={DEFAULT_PIE_OUTER_RADIUS_PERCENT}
          min={40}
          max={90}
          step={1}
          unit="%"
          onChange={(outerRadiusPercent) => patch({ outerRadiusPercent })}
        />
        {isDonut ? (
          <ChartDeSliderField
            label="内径"
            value={pie.innerRadiusPercent}
            fallback={DEFAULT_PIE_INNER_RADIUS_PERCENT}
            min={PIE_INNER_RADIUS_MIN}
            max={PIE_INNER_RADIUS_MAX}
            step={1}
            unit="%"
            onChange={(innerRadiusPercent) => patch({ innerRadiusPercent })}
          />
        ) : null}
        <ChartDeSliderField
          label="扇区间距"
          value={pie.padAngle}
          fallback={0}
          min={0}
          max={8}
          step={0.5}
          onChange={(padAngle) => patch({ padAngle })}
        />
      </div>
    </ChartInspectorSection>
  );
}

export function ChartGaugeStyleSection() {
  const { cfg, mutateChartConfig } = useChartInspector();
  const gauge = readChartDeStyle(cfg).gauge ?? {};
  const patch = (p: Record<string, unknown>) =>
    mutateChartConfig((c) => patchChartDeStyleNested(c, "gauge", p));

  return (
    <ChartInspectorSection title="仪表样式" data-testid="chart-gauge-shape">
      <div className={INSPECTOR_SECTION_GAP}>
        <ChartDeSliderField label="最小值" value={gauge.min} fallback={0} min={0} max={1000} step={1} onChange={(min) => patch({ min })} />
        <ChartDeSliderField label="最大值" value={gauge.max} fallback={100} min={1} max={10000} step={1} onChange={(max) => patch({ max })} />
        <ChartDeSliderField label="起始角 °" value={gauge.startAngleDeg} fallback={-135} min={-180} max={0} step={5} onChange={(startAngleDeg) => patch({ startAngleDeg })} />
        <ChartDeSliderField label="结束角 °" value={gauge.endAngleDeg} fallback={135} min={0} max={180} step={5} onChange={(endAngleDeg) => patch({ endAngleDeg })} />
        <ChartDeSliderField label="刻度数" value={gauge.splitNumber} fallback={5} min={2} max={20} step={1} onChange={(splitNumber) => patch({ splitNumber })} />
      </div>
    </ChartInspectorSection>
  );
}

export function ChartLiquidStyleSection() {
  const { cfg, mutateChartConfig } = useChartInspector();
  const liquid = readChartDeStyle(cfg).liquid ?? {};
  const patch = (p: Record<string, unknown>) =>
    mutateChartConfig((c) => patchChartDeStyleNested(c, "liquid", p));

  return (
    <ChartInspectorSection
      title="水波样式"
      hint="目标值请在「标签 → 完成度」配置；此处仅调整图形外观。"
      data-testid="chart-liquid-shape"
    >
      <div className={INSPECTOR_SECTION_GAP}>
        <ChartDeSliderField
          label="图形大小"
          value={liquid.size}
          fallback={DEFAULT_LIQUID_SIZE}
          min={20}
          max={100}
          step={1}
          onChange={(size) => patch({ size })}
        />
        <ChartDeSliderField label="轮廓宽度" value={liquid.outlineWidth} fallback={2} min={0} max={8} step={1} onChange={(outlineWidth) => patch({ outlineWidth })} />
      </div>
    </ChartInspectorSection>
  );
}

export function ChartKpiIndicatorSection() {
  const { cfg, mutateChartConfig } = useChartInspector();
  const kpi = readChartDeStyle(cfg).kpi ?? {};
  const patch = (p: Record<string, unknown>) =>
    mutateChartConfig((c) => patchChartDeStyleNested(c, "kpi", p));

  return (
    <ChartInspectorSection title="指标样式" data-testid="chart-kpi-indicator">
      <div className={INSPECTOR_SECTION_GAP}>
        <ChartDeSliderField label="字号" value={kpi.fontSize} fallback={40} min={20} max={80} step={1} onChange={(fontSize) => patch({ fontSize })} />
        <div className="border-b border-gray-100 py-2 dark:border-white/[0.06]">
          <p className="mb-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">对齐</p>
          <Select value={kpi.align ?? "center"} onValueChange={(align) => patch({ align })}>
            <SelectTrigger className={INSPECTOR_SELECT} aria-label="指标对齐">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">左</SelectItem>
              <SelectItem value="center">中</SelectItem>
              <SelectItem value="right">右</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </ChartInspectorSection>
  );
}

export function ChartFunnelShapeSection() {
  const { cfg, mutateChartConfig } = useChartInspector();
  const funnel = readChartDeStyle(cfg).funnel ?? {};
  const patch = (p: Record<string, unknown>) =>
    mutateChartConfig((c) => patchChartDeStyleNested(c, "funnel", p));

  return (
    <ChartInspectorSection title="漏斗样式" data-testid="chart-funnel-shape">
      <div className={INSPECTOR_SECTION_GAP}>
        <ChartDeSliderField label="层间距" value={funnel.gap} fallback={4} min={0} max={24} step={1} onChange={(gap) => patch({ gap })} />
        <InspectorSwitchRow
          label="显示转化率"
          checked={funnel.showConversionRate === true}
          onCheckedChange={(showConversionRate) => patch({ showConversionRate })}
        />
      </div>
    </ChartInspectorSection>
  );
}

export function ChartSankeyShapeSection() {
  const { cfg, mutateChartConfig } = useChartInspector();
  const sankey = readChartDeStyle(cfg).sankey ?? {};
  const patch = (p: Record<string, unknown>) =>
    mutateChartConfig((c) => patchChartDeStyleNested(c, "sankey", p));

  return (
    <ChartInspectorSection title="桑基样式" data-testid="chart-sankey-shape">
      <div className={INSPECTOR_SECTION_GAP}>
        <ChartDeSliderField label="节点宽度" value={sankey.nodeWidth} fallback={12} min={4} max={40} step={1} onChange={(nodeWidth) => patch({ nodeWidth })} />
        <ChartDeSliderField label="节点间距" value={sankey.nodeGap} fallback={8} min={0} max={32} step={1} onChange={(nodeGap) => patch({ nodeGap })} />
        <ChartDeSliderField label="链接透明度" value={sankey.linkOpacity} fallback={0.4} min={0.1} max={1} step={0.05} onChange={(linkOpacity) => patch({ linkOpacity })} />
      </div>
    </ChartInspectorSection>
  );
}

export function ChartGraphShapeSection() {
  const { cfg, mutateChartConfig } = useChartInspector();
  const graph = readChartDeStyle(cfg).graph ?? {};

  return (
    <ChartInspectorSection title="关系图样式" data-testid="chart-graph-shape">
      <div className={INSPECTOR_SECTION_GAP}>
        <ChartDeSliderField
          label="斥力"
          value={graph.repulsion}
          fallback={120}
          min={20}
          max={400}
          step={10}
          onChange={(repulsion) =>
            mutateChartConfig((current) => patchBlock(current, "graph", { repulsion }))
          }
        />
        <ChartDeSliderField
          label="边长"
          value={graph.edgeLength}
          fallback={80}
          min={20}
          max={300}
          step={5}
          onChange={(edgeLength) =>
            mutateChartConfig((current) => patchBlock(current, "graph", { edgeLength }))
          }
        />
      </div>
    </ChartInspectorSection>
  );
}

export function ChartRadarShapeSection() {
  const { cfg, mutateChartConfig } = useChartInspector();
  const radar = readChartDeStyle(cfg).radar ?? {};
  const patch = (p: Record<string, unknown>) =>
    mutateChartConfig((c) => patchChartDeStyleNested(c, "radar", p));

  return (
    <ChartInspectorSection title="雷达样式" data-testid="chart-radar-shape">
      <div className={INSPECTOR_SECTION_GAP}>
        <div className="border-b border-gray-100 py-2 dark:border-white/[0.06]">
          <p className="mb-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">形状</p>
          <Select
            value={radar.shape ?? "circle"}
            onValueChange={(shape) => patch({ shape })}
          >
            <SelectTrigger className={INSPECTOR_SELECT} aria-label="雷达图形状">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="polygon">多边形</SelectItem>
              <SelectItem value="circle">圆形</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <InspectorSwitchRow
          label="启用面积"
          checked={radar.showArea !== false}
          onCheckedChange={(showArea) => patch({ showArea })}
        />
        <ChartDeSliderField
          label="区域透明度"
          value={radar.areaOpacity}
          fallback={0.25}
          min={0.05}
          max={0.8}
          step={0.05}
          onChange={(areaOpacity) => patch({ areaOpacity })}
        />
        <InspectorSwitchRow
          label="辅助点"
          checked={radar.showSymbol === true}
          onCheckedChange={(showSymbol) => patch({ showSymbol })}
        />
        <ChartDeSliderField
          label="半径 %"
          value={radar.radiusPercent}
          fallback={DEFAULT_RADAR_RADIUS_PERCENT}
          min={RADAR_RADIUS_PERCENT_MIN}
          max={RADAR_RADIUS_PERCENT_MAX}
          step={1}
          unit="%"
          onChange={(radiusPercent) => patch({ radiusPercent })}
        />
        <div className="border-t border-gray-100 pt-2 dark:border-white/[0.06]">
          <p className="mb-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">坐标轴</p>
          <InspectorSwitchRow
            label="显示名称"
            checked={radar.showAxisName !== false}
            onCheckedChange={(showAxisName) => patch({ showAxisName })}
          />
          <InspectorInlineColorRow
            label="轴名称颜色"
            value={radar.axisLabelColor ?? "#94a3b8"}
            onChange={(axisLabelColor) => patch({ axisLabelColor })}
          />
          <InspectorInlineColorRow
            label="轴线颜色"
            value={radar.axisLineColor ?? "#cbd5e1"}
            onChange={(axisLineColor) => patch({ axisLineColor })}
          />
          <ChartDeSliderField
            label="轴线宽度"
            value={radar.axisLineWidth}
            fallback={1}
            min={0.5}
            max={3}
            step={0.5}
            onChange={(axisLineWidth) => patch({ axisLineWidth })}
          />
          <ChartDeSliderField
            label="分割段数"
            value={radar.splitNumber}
            fallback={5}
            min={2}
            max={10}
            step={1}
            onChange={(splitNumber) => patch({ splitNumber })}
          />
        </div>
      </div>
    </ChartInspectorSection>
  );
}

export function ChartWordCloudShapeSection() {
  const { cfg, mutateChartConfig } = useChartInspector();
  const wordCloud = readChartDeStyle(cfg).wordCloud ?? {};
  const patch = (p: Record<string, unknown>) =>
    mutateChartConfig((c) => patchChartDeStyleNested(c, "wordCloud", p));

  return (
    <ChartInspectorSection title="词云样式" data-testid="chart-wordcloud-shape">
      <div className={INSPECTOR_SECTION_GAP}>
        <ChartDeSliderField label="最小字号" value={wordCloud.fontSizeMin} fallback={12} min={6} max={48} step={1} onChange={(fontSizeMin) => patch({ fontSizeMin })} />
        <ChartDeSliderField label="最大字号" value={wordCloud.fontSizeMax} fallback={48} min={16} max={96} step={1} onChange={(fontSizeMax) => patch({ fontSizeMax })} />
        <ChartDeSliderField label="间距" value={wordCloud.spacing} fallback={2} min={0} max={16} step={1} onChange={(spacing) => patch({ spacing })} />
      </div>
    </ChartInspectorSection>
  );
}

export function ChartTreemapShapeSection() {
  const { cfg, mutateChartConfig } = useChartInspector();
  const treemap = readChartDeStyle(cfg).treemap ?? {};
  const patch = (p: Record<string, unknown>) =>
    mutateChartConfig((c) => patchChartDeStyleNested(c, "treemap", p));

  return (
    <ChartInspectorSection title="矩形树图样式" data-testid="chart-treemap-shape">
      <div className={INSPECTOR_SECTION_GAP}>
        <ChartDeSliderField label="内间距" value={treemap.paddingInner} fallback={DEFAULT_TREEMAP_PADDING_INNER} min={0} max={24} step={1} onChange={(paddingInner) => patch({ paddingInner })} />
        <ChartDeSliderField label="外间距" value={treemap.paddingOuter} fallback={DEFAULT_TREEMAP_PADDING_OUTER} min={0} max={24} step={1} onChange={(paddingOuter) => patch({ paddingOuter })} />
        <ChartDeSliderField label="圆角" value={treemap.cellRadius} fallback={DEFAULT_TREEMAP_CELL_RADIUS} min={0} max={12} step={1} onChange={(cellRadius) => patch({ cellRadius })} />
      </div>
    </ChartInspectorSection>
  );
}

export function ChartCirclePackingShapeSection() {
  const { cfg, mutateChartConfig } = useChartInspector();
  const circlePacking = readChartDeStyle(cfg).circlePacking ?? {};
  const patch = (p: Record<string, unknown>) =>
    mutateChartConfig((c) => patchChartDeStyleNested(c, "circlePacking", p));

  return (
    <ChartInspectorSection title="圆形填充样式" data-testid="chart-circle-packing-shape">
      <div className={INSPECTOR_SECTION_GAP}>
        <InspectorInlineColorRow
          label="内部填充色"
          allowClear
          swatches={WIDGET_BORDER_RECOMMENDED}
          value={circlePacking.backgroundColor ?? ""}
          onChange={(backgroundColor) => patch({ backgroundColor })}
        />
        <ChartDeSliderField
          label="整体大小"
          value={circlePacking.sizePercent}
          fallback={DEFAULT_CIRCLE_PACKING_SIZE_PERCENT}
          min={40}
          max={100}
          step={1}
          unit="%"
          onChange={(sizePercent) => patch({ sizePercent })}
        />
        <InspectorSwitchRow
          label="显示外圈"
          checked={circlePacking.showOuterRing !== false}
          onCheckedChange={(showOuterRing) => patch({ showOuterRing })}
        />
        <ChartDeSliderField label="布局间距" value={circlePacking.layoutPadding} fallback={0} min={0} max={16} step={1} onChange={(layoutPadding) => patch({ layoutPadding })} />
        <ChartDeSliderField label="标签最小半径" value={circlePacking.labelMinRadius} fallback={10} min={8} max={48} step={1} onChange={(labelMinRadius) => patch({ labelMinRadius })} />
      </div>
    </ChartInspectorSection>
  );
}

export function ChartTooltipStyleSection() {
  const { cfg, patchDeStyleNested, dashboardStyle } = useChartInspector();
  const deStyle = readChartDeStyle(cfg);
  const tooltip = deStyle.tooltip ?? {};
  const tooltipShow = tooltip.show !== false;

  return (
    <ChartInspectorSection
      title="提示"
      data-testid="chart-tooltip-style"
      enabled={tooltipShow}
      action={
        <Switch
          checked={tooltipShow}
          onCheckedChange={(show) => patchDeStyleNested("tooltip", { show })}
          aria-label="显示提示"
          size={INSPECTOR_SWITCH_SIZE}
        />
      }
    >
      <div className={INSPECTOR_SECTION_GAP}>
        <InspectorInlineColorRow
          label="字体颜色"
          allowClear
          swatches={TEXT_COLOR_RECOMMENDED}
          value={tooltip.color ?? ""}
          fallbackValue={resolveChartTooltipDisplayColor(cfg, dashboardStyle)}
          onChange={(color) =>
            patchDeStyleNested("tooltip", { color: color || undefined })
          }
        />
        <InspectorInlineColorRow
          label="背景颜色"
          allowClear
          swatches={TEXT_COLOR_RECOMMENDED}
          value={tooltip.background ?? ""}
          fallbackValue={resolveChartTooltipDisplayBackground(cfg, dashboardStyle)}
          onChange={(background) =>
            patchDeStyleNested("tooltip", { background: background || undefined })
          }
        />
        <ChartDeSliderField
          label="字号"
          value={tooltip.fontSize}
          fallback={dashboardStyle?.chartTooltipStyle?.fontSize ?? 12}
          min={6}
          max={20}
          step={1}
          onChange={(fontSize) => patchDeStyleNested("tooltip", { fontSize })}
        />
      </div>
    </ChartInspectorSection>
  );
}
