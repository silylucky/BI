import { InspectorSliderField } from "@/components/dashboard/deAttrSlider";
import {
  INSPECTOR_CTRL,
  INSPECTOR_SECTION_GAP,
  InspectorFieldLabel,
  InspectorInlineColorRow,
  InspectorSwitchRow,
} from "@/components/dashboard/inspectorCompact";
import type { GisProjectOverlay } from "@/components/charts/engine/maplibre/gisProject";
import type { ResolvedGisOverlayStyle } from "@/components/charts/engine/maplibre/gisProject";

type ChartGisMapLayerStyleFieldsProps = {
  resolved: ResolvedGisOverlayStyle;
  kind: "scatter" | "heatmap";
  onPatch: (patch: GisProjectOverlay) => void;
};

export function ChartGisMapLayerStyleFields({
  resolved,
  kind,
  onPatch,
}: ChartGisMapLayerStyleFieldsProps) {
  return (
    <div className={INSPECTOR_SECTION_GAP}>
      {kind === "scatter" ? (
        <>
          <InspectorInlineColorRow
            label="散点颜色"
            hint="默认取图表配色首色"
            value={resolved.color}
            allowClear={false}
            onChange={(color) => color && onPatch({ color })}
          />
          <InspectorInlineColorRow
            label="描边颜色"
            value={resolved.strokeColor}
            allowClear={false}
            onChange={(strokeColor) => strokeColor && onPatch({ strokeColor })}
          />
        </>
      ) : (
        <div className="grid gap-1.5">
          <InspectorFieldLabel label="热力色带" hint="Ember 暖色柔光；Night 冷色；Scientific 跟随图表配色" />
          <select
            className={INSPECTOR_CTRL}
            value={resolved.heatmapPreset}
            aria-label="热力色带"
            onChange={(event) => {
              const value = event.target.value;
              onPatch({
                heatmapPreset:
                  value === "scientific" ? "scientific" : value === "night" ? "night" : "ember",
              });
            }}
          >
            <option value="ember">Ember Glow</option>
            <option value="night">Night Glow</option>
            <option value="scientific">Scientific</option>
          </select>
        </div>
      )}

      <InspectorSliderField
        label="不透明度"
        value={Math.round(resolved.opacity * 100)}
        min={0}
        max={100}
        step={1}
        unit="%"
        onChange={(next) => onPatch({ opacity: next / 100 })}
      />

      {kind === "heatmap" ? (
        <>
          <InspectorSliderField
            label="热力强度"
            hint="远景密度增强；近景自动减弱"
            value={Math.round(resolved.heatmapIntensity * 100)}
            min={40}
            max={200}
            step={5}
            unit="%"
            onChange={(next) => onPatch({ heatmapIntensity: next / 100 })}
          />
          <InspectorSliderField
            label="模糊半径"
            hint="高 zoom 时的热力柔化范围"
            value={resolved.heatmapRadiusMax}
            min={8}
            max={40}
            step={1}
            unit="px"
            onChange={(heatmapRadiusMax) => onPatch({ heatmapRadiusMax })}
          />
          <InspectorSliderField
            label="切换为散点 zoom"
            hint="高于此级别热力淡出，显示精细圆点"
            value={resolved.heatmapCrossfadeZoom}
            min={6}
            max={14}
            step={0.5}
            onChange={(heatmapCrossfadeZoom) => onPatch({ heatmapCrossfadeZoom })}
          />
        </>
      ) : null}

      {kind === "scatter" ? (
        <>
          <InspectorSliderField
            label="最小半径"
            value={resolved.radiusMin}
            min={2}
            max={24}
            step={1}
            unit="px"
            onChange={(radiusMin) => onPatch({ radiusMin: Math.min(radiusMin, resolved.radiusMax) })}
          />
          <InspectorSliderField
            label="最大半径"
            value={resolved.radiusMax}
            min={resolved.radiusMin}
            max={36}
            step={1}
            unit="px"
            onChange={(radiusMax) => onPatch({ radiusMax })}
          />
        </>
      ) : null}

      {kind === "scatter" ? (
        <>
          <InspectorSliderField
            label="描边宽度"
            value={resolved.strokeWidth}
            min={0}
            max={3}
            step={0.25}
            unit="px"
            onChange={(strokeWidth) => onPatch({ strokeWidth })}
          />
          <InspectorSliderField
            label="柔边"
            hint="轻微 blur 让散点更柔和"
            value={Math.round(resolved.circleBlur * 100)}
            min={0}
            max={60}
            step={5}
            unit="%"
            onChange={(next) => onPatch({ circleBlur: next / 100 })}
          />
          <InspectorSliderField
            label="光晕强度"
            hint="自发光柔光；散点与热力共用"
            value={Math.round(resolved.glowStrength * 100)}
            min={0}
            max={100}
            step={5}
            unit="%"
            onChange={(next) => onPatch({ glowStrength: next / 100 })}
          />
          <InspectorSwitchRow
            label="感知缩放"
            hint="按面积感知放大差异（推荐）"
            checked={resolved.sizeCurve === "perceptual"}
            onCheckedChange={(checked) => onPatch({ sizeCurve: checked ? "perceptual" : "linear" })}
          />
          <InspectorSwitchRow
            label="按指标缩放大小"
            checked={resolved.scaleByMetric}
            onCheckedChange={(scaleByMetric) => onPatch({ scaleByMetric })}
          />
          <InspectorSwitchRow
            label="按类别分色"
            checked={resolved.colorByCategory}
            onCheckedChange={(colorByCategory) => onPatch({ colorByCategory })}
          />
          <InspectorSwitchRow
            label="低 zoom 聚合"
            checked={resolved.cluster}
            onCheckedChange={(cluster) => onPatch({ cluster })}
          />
          {resolved.cluster ? (
            <>
              <InspectorSliderField
                label="聚合半径"
                hint="像素距离内合并为气泡"
                value={resolved.clusterRadius}
                min={32}
                max={88}
                step={4}
                unit="px"
                onChange={(clusterRadius) => onPatch({ clusterRadius })}
              />
              <InspectorSliderField
                label="聚合最大 zoom"
                hint="高于此 zoom 时显示单个散点"
                value={resolved.clusterMaxZoom}
                min={0}
                max={18}
                step={1}
                onChange={(clusterMaxZoom) => onPatch({ clusterMaxZoom })}
              />
            </>
          ) : null}
          <InspectorSwitchRow
            label="显示标签"
            checked={resolved.showLabels}
            onCheckedChange={(showLabels) => onPatch({ showLabels })}
          />
          {resolved.showLabels ? (
            <div className="grid gap-1.5">
              <InspectorFieldLabel label="标签最小 zoom" hint="缩放级别低于此值时隐藏标签" />
              <input
                type="number"
                className={INSPECTOR_CTRL}
                min={0}
                max={18}
                step={0.5}
                value={resolved.labelMinZoom}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next) && next >= 0) onPatch({ labelMinZoom: next });
                }}
                aria-label="标签最小 zoom"
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
