import { useCallback, useEffect, useRef } from "react";
import {
  hasCustomGeoRegionBorderColor,
  MAX_GEO_REGION_BORDER_WIDTH_SCALE,
  MIN_GEO_REGION_BORDER_WIDTH_SCALE,
  DEFAULT_GEO_REGION_BORDER_WIDTH_SCALE,
  resolveGeoRegionBorderColorHex,
  resolveGeoRegionBorderShow,
} from "@/components/charts/engine/geo/geoRegionBorderStyle";
import {
  hasCustomGeoRegionLabelColor,
  DEFAULT_GEO_REGION_LABEL_FONT_SIZE,
  resolveGeoRegionLabelPanelColorHex,
  resolveGeoRegionLabelFallbackHex,
} from "@/components/charts/engine/geo/geoRegionLabelStyle";
import {
  DEFAULT_SCENE_CLOUD_DENSITY,
  DEFAULT_SCENE_CLOUD_HEIGHT,
  DEFAULT_SCENE_CLOUD_SPEED,
  SCENE_CLOUD_SPEED_MAX,
} from "@/components/charts/engine/three/geo3dSceneCloudStyle";
import {
  DEFAULT_PLATFORM_GRID_DENSITY,
  DEFAULT_PLATFORM_RIPPLE_SPEED,
  DEFAULT_PLATFORM_RIPPLE_FREQUENCY,
  resolvePlatformGridStyle,
} from "@/components/charts/engine/three/geo3dPlatformStyle";
import {
  DEFAULT_PLATFORM_GRID_OPACITY,
  DEFAULT_PLATFORM_GLOW_OPACITY,
  DEFAULT_PLATFORM_HIGHLIGHT_OPACITY,
  DEFAULT_PLATFORM_PULSE_OPACITY,
  DEFAULT_PLATFORM_PULSE_SPEED,
  DEFAULT_PLATFORM_RING_OPACITY,
  DEFAULT_PLATFORM_RING_SPEED,
  DEFAULT_PLATFORM_RIPPLE_OPACITY,
  DEFAULT_PLATFORM_SIZE_SCALE,
  DEFAULT_PLATFORM_SWEEP_OPACITY,
  DEFAULT_PLATFORM_SWEEP_SPEED,
  hasCustomPlatformGlowColor,
  hasCustomPlatformGridColor,
  hasCustomPlatformHighlightColor,
  hasCustomPlatformPulseColor,
  hasCustomPlatformRippleColor,
  hasCustomPlatformSweepColor,
  resolvePlatformGlowColorHex,
  resolvePlatformGridColorHex,
  resolvePlatformHighlightColorHex,
  resolvePlatformPulseColorHex,
  resolvePlatformRippleColorHex,
  resolvePlatformSweepColorHex,
} from "@/components/charts/engine/three/geo3dPlatformStyle";
import {
  DEFAULT_FLOATING_LABEL_FONT_SIZE,
  DEFAULT_FLOATING_LABEL_OFFSET,
  DEFAULT_FLOATING_LABEL_TEXT_COLOR,
  DEFAULT_FLOATING_LABEL_BG_COLOR,
  DEFAULT_FLOATING_LABEL_BORDER_COLOR,
  DEFAULT_HEAT_BLOB_BLUR,
  DEFAULT_HEAT_BLOB_COLOR,
  DEFAULT_HEAT_BLOB_DIM_CHOROPLETH,
  DEFAULT_HEAT_BLOB_LIFT,
  DEFAULT_HEAT_BLOB_OPACITY,
  DEFAULT_HEAT_BLOB_RADIUS,
  MAX_HEAT_BLOB_RADIUS,
  MIN_HEAT_BLOB_RADIUS,
  DEFAULT_POINT_PILLAR_BASE_RING_OPACITY,
  DEFAULT_POINT_PILLAR_BASE_RING_SCALE,
  DEFAULT_POINT_PILLAR_COLOR_BOTTOM,
  DEFAULT_POINT_PILLAR_COLOR_TOP,
  DEFAULT_POINT_PILLAR_HEIGHT_SCALE,
  DEFAULT_POINT_PILLAR_OPACITY,
  DEFAULT_POINT_PILLAR_RING_SPEED,
  hasCustomHeatBlobColor,
  hasCustomFloatingLabelTextColor,
  hasCustomFloatingLabelBgColor,
  hasCustomFloatingLabelBorderColor,
  hasCustomPointPillarColorBottom,
  hasCustomPointPillarColorTop,
} from "@/components/charts/engine/three/geo3dPointEffectsStyle";
import {
  GEO3D_STYLE_PRESETS,
  geo3dPresetDefaults,
  hasCustomGeo3dShellColor,
  resolveGeo3dPointEffects,
  resolveGeo3dSceneClouds,
  resolveGeo3dPlatformEffects,
  resolveGeo3dShellColorHex,
  resolveGeo3dStylePreset,
  type Geo3dStylePreset,
} from "@/components/charts/engine/three/geo3dVisualStyle";
import { useChartInspector } from "@/components/dashboard/chartInspectorContext";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import {
  DEFAULT_GEO3D_EXTRUDE_INTENSITY,
  DEFAULT_GEO3D_SHELL_OPACITY,
  patchChartDeStyleNested,
  readChartGeoStyle,
  readChartGeo3dStyle,
  type ChartDeStyle,
} from "@/lib/chartDeStyle";
import { ChartDeAttrSliderField as DeAttrSliderField } from "./deAttrSlider";
import {
  ChartInspectorSection,
  INSPECTOR_SECTION_GAP,
  INSPECTOR_SELECT_TRIGGER,
  InspectorFieldRow,
  InspectorInlineColorRow,
  InspectorSwitchRow,
} from "./inspectorCompact";
import { WIDGET_BORDER_RECOMMENDED, TEXT_COLOR_RECOMMENDED } from "./dashboardStyleConfig";
import { ChartPaletteFontSizeSelect } from "./chartPaletteShared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ChartGeoStylePanelProps = {
  cfg: ChartViewConfig;
  deStyle: ChartDeStyle;
  chartType: "map" | "map-3d" | "heatmap";
  onChange: (cfg: ChartViewConfig) => void;
};

/** DataEase 对标：地图/热力图专属样式 */
export function ChartGeoStylePanel({ cfg, deStyle, chartType, onChange }: ChartGeoStylePanelProps) {
  const { dashboardStyle } = useChartInspector();
  const isDarkTheme = dashboardStyle?.colorScheme === "dark";
  const geo = readChartGeoStyle(deStyle);
  const geo3d = readChartGeo3dStyle(deStyle);
  const patchGeo = (patch: Parameters<typeof patchChartDeStyleNested>[2]) =>
    onChange(patchChartDeStyleNested(cfg, "geo", patch));
  const patchGeoColorTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const patchGeoColor = useCallback(
    (key: string, patch: Parameters<typeof patchChartDeStyleNested>[2]) => {
      const timers = patchGeoColorTimersRef.current;
      const pending = timers.get(key);
      if (pending) window.clearTimeout(pending);
      timers.set(
        key,
        window.setTimeout(() => {
          timers.delete(key);
          patchGeo(patch);
        }, 200),
      );
    },
    [cfg, onChange],
  );
  const patchGeo3d = (patch: Parameters<typeof patchChartDeStyleNested>[2]) =>
    onChange(patchChartDeStyleNested(cfg, "geo3d", patch));
  const patchGeo3dColorTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const patchGeo3dColor = useCallback(
    (key: string, patch: Parameters<typeof patchChartDeStyleNested>[2]) => {
      const timers = patchGeo3dColorTimersRef.current;
      const pending = timers.get(key);
      if (pending) window.clearTimeout(pending);
      timers.set(
        key,
        window.setTimeout(() => {
          timers.delete(key);
          patchGeo3d(patch);
        }, 200),
      );
    },
    [cfg, onChange],
  );
  useEffect(
    () => () => {
      patchGeo3dColorTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      patchGeo3dColorTimersRef.current.clear();
      patchGeoColorTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      patchGeoColorTimersRef.current.clear();
    },
    [cfg],
  );
  const isMap = chartType === "map" || chartType === "map-3d";
  const is3d = chartType === "map-3d";
  const showRegionBorder = resolveGeoRegionBorderShow(geo);
  const borderColorPreset = is3d ? resolveGeo3dStylePreset(geo3d) : undefined;
  const platformOn = resolveGeo3dPlatformEffects(geo3d);
  const platformHighlightOn = platformOn && geo3d.platformHighlight !== false;
  const platformRingsOn = platformOn && geo3d.platformRings !== false;
  const platformGridOn = platformOn && geo3d.platformGrid !== false;
  const platformRippleOn = platformOn && geo3d.platformRipple !== false;
  const platformGlowOn = platformOn && geo3d.platformGlow === true;
  const platformPulseOn = platformOn && geo3d.platformPulse === true;
  const platformSweepOn = platformOn && geo3d.platformSweep === true;
  const pointEffectsOn = resolveGeo3dPointEffects(geo3d);
  const heatBlobOn = pointEffectsOn && geo3d.heatBlob !== false;
  const pointPillarOn = pointEffectsOn && geo3d.pointPillar !== false;
  const floatingLabelsOn = pointEffectsOn && geo3d.floatingLabels !== false;

  const sectionHint = isMap
    ? is3d
      ? "离线中国 3D：可选卫星/科技/经典/简洁样式；双击下钻。"
      : "离线中国地图：滚轮缩放与拖拽平移；配置「地区/维度」「数据/指标」与「钻取/维度」，预览态双击下钻。"
    : "对标 DataEase 分类热力图：横轴、纵轴各一维度，指标决定色深；重复单元格自动求和。";

  return (
    <ChartInspectorSection
      title={isMap ? "地图样式" : "热力图样式"}
      hint={sectionHint}
      data-testid="chart-geo-style"
    >
      <div className={INSPECTOR_SECTION_GAP}>
        {isMap ? (
          <InspectorSwitchRow
            label="缩放平移"
            checked={geo.roam !== false}
            onCheckedChange={(roam) => patchGeo({ roam })}
          />
        ) : null}
        {isMap && chartType === "map" ? (
          <>
          <InspectorSwitchRow
            label="区域标签"
            checked={geo.showRegionLabel === true}
            onCheckedChange={(showRegionLabel) => patchGeo({ showRegionLabel })}
          />
            {geo.showRegionLabel === true ? (
              <>
                <InspectorInlineColorRow
                  label="字体颜色"
                  value={resolveGeoRegionLabelPanelColorHex(geo, isDarkTheme)}
                  fallbackValue={resolveGeoRegionLabelFallbackHex(isDarkTheme)}
                  allowClear={hasCustomGeoRegionLabelColor(geo)}
                  swatches={TEXT_COLOR_RECOMMENDED}
                  onChange={(next) => patchGeoColor("regionLabelColor", { regionLabelColor: next })}
                />
                <ChartPaletteFontSizeSelect
                  density="narrow"
                  value={geo.regionLabelFontSize}
                  fallback={DEFAULT_GEO_REGION_LABEL_FONT_SIZE}
                  onChange={(regionLabelFontSize) => patchGeo({ regionLabelFontSize })}
                />
              </>
            ) : null}
          </>
        ) : null}
        {chartType === "heatmap" ? (
          <InspectorSwitchRow
            label="单元格数值"
            checked={geo.showCellLabel === true}
            onCheckedChange={(showCellLabel) => patchGeo({ showCellLabel })}
          />
        ) : null}
        {!is3d ? (
        <InspectorSwitchRow
          label="数值色带"
          checked={geo.visualMap !== false}
          onCheckedChange={(visualMap) => patchGeo({ visualMap })}
        />
        ) : null}
        {isMap ? (
          <>
            <InspectorSwitchRow
              label="行政区边界"
              hint="边界随下钻层级切换：全国显示省界，省级显示市界，市级显示区县界。"
              checked={showRegionBorder}
              onCheckedChange={(next) => patchGeo({ showRegionBorder: next })}
            />
            {showRegionBorder && is3d ? (
              <InspectorInlineColorRow
                label="边界颜色"
                value={resolveGeoRegionBorderColorHex(geo, isDarkTheme, borderColorPreset)}
                fallbackValue={resolveGeoRegionBorderColorHex(
                  { ...geo, regionBorderColor: undefined },
                  isDarkTheme,
                  borderColorPreset,
                )}
                allowClear={hasCustomGeoRegionBorderColor(geo)}
                swatches={WIDGET_BORDER_RECOMMENDED}
                onChange={(next) => patchGeoColor("regionBorderColor", { regionBorderColor: next })}
              />
            ) : null}
            {showRegionBorder && chartType === "map" ? (
              <>
                <InspectorInlineColorRow
                  label="地图边线"
                  value={resolveGeoRegionBorderColorHex(geo, isDarkTheme)}
                  fallbackValue={resolveGeoRegionBorderColorHex(
                    { ...geo, regionBorderColor: undefined },
                    isDarkTheme,
                  )}
                  allowClear={hasCustomGeoRegionBorderColor(geo)}
                  swatches={WIDGET_BORDER_RECOMMENDED}
                  onChange={(next) => patchGeoColor("regionBorderColor", { regionBorderColor: next })}
                />
                <DeAttrSliderField
                  label="边线宽度"
                  compact
                  value={geo.regionBorderWidth}
                  fallback={DEFAULT_GEO_REGION_BORDER_WIDTH_SCALE}
                  min={MIN_GEO_REGION_BORDER_WIDTH_SCALE}
                  max={MAX_GEO_REGION_BORDER_WIDTH_SCALE}
                  step={0.1}
                  ariaLabel="地图边线宽度"
                  onChange={(regionBorderWidth) => patchGeo({ regionBorderWidth })}
                />
              </>
            ) : null}
          </>
        ) : null}
        {is3d ? (
          <>
            <InspectorSwitchRow
              label="数值图例"
              checked={geo.visualMap === true}
              onCheckedChange={(visualMap) => patchGeo({ visualMap })}
            />
            <InspectorFieldRow
              label="3D 样式"
              hint={GEO3D_STYLE_PRESETS.find((p) => p.value === resolveGeo3dStylePreset(geo3d))?.hint}
            >
              <Select
                value={resolveGeo3dStylePreset(geo3d)}
                onValueChange={(preset) =>
                  patchGeo3d(geo3dPresetDefaults(preset as Geo3dStylePreset))
                }
              >
                <SelectTrigger className={INSPECTOR_SELECT_TRIGGER} aria-label="3D 样式">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GEO3D_STYLE_PRESETS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                    </SelectItem>
                ))}
                </SelectContent>
              </Select>
            </InspectorFieldRow>
            <DeAttrSliderField
              label="底板厚度"
              compact
              value={geo3d.extrudeIntensity}
              fallback={DEFAULT_GEO3D_EXTRUDE_INTENSITY}
                min={0.2}
                max={1.5}
                step={0.05}
              ariaLabel="底板厚度"
              onChange={(extrudeIntensity) => patchGeo3d({ extrudeIntensity })}
            />
            <InspectorInlineColorRow
              label="底板颜色"
              value={resolveGeo3dShellColorHex(geo3d, isDarkTheme)}
              fallbackValue={resolveGeo3dShellColorHex(
                { ...geo3d, shellColor: undefined },
                isDarkTheme,
              )}
              allowClear={hasCustomGeo3dShellColor(geo3d)}
              swatches={WIDGET_BORDER_RECOMMENDED}
              onChange={(next) => patchGeo3dColor("shellColor", { shellColor: next })}
            />
            <DeAttrSliderField
              label="底板不透明度"
              compact
              value={geo3d.shellOpacity}
              fallback={DEFAULT_GEO3D_SHELL_OPACITY}
              min={0}
              max={1}
              step={0.05}
              ariaLabel="底板不透明度"
              onChange={(shellOpacity) => patchGeo3d({ shellOpacity })}
            />
            <InspectorSwitchRow
              label="场景云"
              checked={resolveGeo3dSceneClouds(geo3d)}
              onCheckedChange={(sceneFog) => patchGeo3d({ sceneFog })}
            />
            {resolveGeo3dSceneClouds(geo3d) ? (
              <>
                <DeAttrSliderField
                  label="云团密度"
                  compact
                  value={geo3d.sceneCloudDensity}
                  fallback={DEFAULT_SCENE_CLOUD_DENSITY}
                  min={0.1}
                  max={1}
                  step={0.05}
                  ariaLabel="场景云密度"
                  onChange={(sceneCloudDensity) => patchGeo3d({ sceneCloudDensity })}
                />
                <DeAttrSliderField
                  label="漂移速度"
                  compact
                  value={geo3d.sceneCloudSpeed}
                  fallback={DEFAULT_SCENE_CLOUD_SPEED}
                  min={0}
                  max={SCENE_CLOUD_SPEED_MAX}
                  step={0.05}
                  ariaLabel="场景云漂移速度"
                  onChange={(sceneCloudSpeed) => patchGeo3d({ sceneCloudSpeed })}
                />
                <DeAttrSliderField
                  label="云高度"
                  compact
                  value={geo3d.sceneCloudHeight}
                  fallback={DEFAULT_SCENE_CLOUD_HEIGHT}
                  min={0.2}
                  max={2}
                  step={0.05}
                  ariaLabel="场景云高度"
                  onChange={(sceneCloudHeight) => patchGeo3d({ sceneCloudHeight })}
                />
              </>
            ) : null}
            <InspectorSwitchRow
              label="底座装饰"
              checked={platformOn}
              onCheckedChange={(platformEffects) => patchGeo3d({ platformEffects })}
            />
            {platformOn ? (
              <>
                <InspectorSwitchRow
                  label="中心高光"
                  checked={platformHighlightOn}
                  onCheckedChange={(platformHighlight) => patchGeo3d({ platformHighlight })}
                />
                {platformHighlightOn ? (
                  <DeAttrSliderField
                    label="高光不透明度"
                    compact
                    value={geo3d.platformHighlightOpacity}
                    fallback={DEFAULT_PLATFORM_HIGHLIGHT_OPACITY}
                    min={0}
                    max={1}
                    step={0.05}
                    ariaLabel="底座高光不透明度"
                    onChange={(platformHighlightOpacity) => patchGeo3d({ platformHighlightOpacity })}
                  />
                ) : null}
                <InspectorSwitchRow
                  label="旋转双环"
                  checked={platformRingsOn}
                  onCheckedChange={(platformRings) => patchGeo3d({ platformRings })}
                />
                {platformHighlightOn || platformRingsOn ? (
                  <InspectorInlineColorRow
                    label="高光/环颜色"
                    value={resolvePlatformHighlightColorHex(geo3d, borderColorPreset, isDarkTheme)}
                    fallbackValue={resolvePlatformHighlightColorHex(
                      { ...geo3d, platformHighlightColor: undefined },
                      borderColorPreset,
                      isDarkTheme,
                    )}
                    allowClear={hasCustomPlatformHighlightColor(geo3d)}
                    swatches={WIDGET_BORDER_RECOMMENDED}
                    onChange={(next) => patchGeo3dColor("platformHighlightColor", { platformHighlightColor: next })}
                  />
                ) : null}
                {platformRingsOn ? (
                  <>
                    <DeAttrSliderField
                      label="双环不透明度"
                      compact
                      value={geo3d.platformRingOpacity}
                      fallback={DEFAULT_PLATFORM_RING_OPACITY}
                      min={0}
                      max={1}
                      step={0.05}
                      ariaLabel="底座双环不透明度"
                      onChange={(platformRingOpacity) => patchGeo3d({ platformRingOpacity })}
                    />
                    <DeAttrSliderField
                      label="旋转速度"
                      compact
                      value={geo3d.platformRingSpeed}
                      fallback={DEFAULT_PLATFORM_RING_SPEED}
                      min={0.2}
                      max={3}
                      step={0.1}
                      ariaLabel="底座双环旋转速度"
                      onChange={(platformRingSpeed) => patchGeo3d({ platformRingSpeed })}
                    />
                  </>
                ) : null}
                <InspectorSwitchRow
                  label="底网格"
                  checked={platformGridOn}
                  onCheckedChange={(platformGrid) => patchGeo3d({ platformGrid })}
                />
                {platformGridOn ? (
                  <>
                    <InspectorFieldRow label="网格样式">
                      <Select
                        value={resolvePlatformGridStyle(geo3d)}
                        onValueChange={(platformGridStyle) =>
                          patchGeo3d({
                            platformGridStyle: platformGridStyle as "texture" | "square",
                          })
                        }
                      >
                        <SelectTrigger className={INSPECTOR_SELECT_TRIGGER} aria-label="底座网格样式">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="texture">圆点纹理</SelectItem>
                          <SelectItem value="square">正方形格</SelectItem>
                        </SelectContent>
                      </Select>
                    </InspectorFieldRow>
                    {resolvePlatformGridStyle(geo3d) === "square" ? (
                      <DeAttrSliderField
                        label="方格密度"
                        compact
                        value={geo3d.platformGridDensity}
                        fallback={DEFAULT_PLATFORM_GRID_DENSITY}
                        min={0.5}
                        max={3}
                        step={0.05}
                        ariaLabel="正方形网格密度"
                        onChange={(platformGridDensity) => patchGeo3d({ platformGridDensity })}
                      />
                    ) : null}
                    <InspectorInlineColorRow
                      label="网格颜色"
                      value={resolvePlatformGridColorHex(geo3d, borderColorPreset, isDarkTheme)}
                      fallbackValue={resolvePlatformGridColorHex(
                        { ...geo3d, platformGridColor: undefined },
                        borderColorPreset,
                        isDarkTheme,
                      )}
                      allowClear={hasCustomPlatformGridColor(geo3d)}
                      swatches={WIDGET_BORDER_RECOMMENDED}
                      onChange={(next) => patchGeo3dColor("platformGridColor", { platformGridColor: next })}
                    />
                    <DeAttrSliderField
                      label="网格不透明度"
                      compact
                      value={geo3d.platformGridOpacity}
                      fallback={DEFAULT_PLATFORM_GRID_OPACITY}
                      min={0}
                      max={1}
                      step={0.05}
                      ariaLabel="底座网格不透明度"
                      onChange={(platformGridOpacity) => patchGeo3d({ platformGridOpacity })}
                    />
                  </>
                ) : null}
                <InspectorSwitchRow
                  label="扩散涟漪"
                  checked={platformRippleOn}
                  onCheckedChange={(platformRipple) => patchGeo3d({ platformRipple })}
                />
                {platformRippleOn ? (
                  <>
                    <InspectorInlineColorRow
                      label="涟漪颜色"
                      value={resolvePlatformRippleColorHex(geo3d, borderColorPreset, isDarkTheme)}
                      fallbackValue={resolvePlatformRippleColorHex(
                        { ...geo3d, platformRippleColor: undefined },
                        borderColorPreset,
                        isDarkTheme,
                      )}
                      allowClear={hasCustomPlatformRippleColor(geo3d)}
                      swatches={WIDGET_BORDER_RECOMMENDED}
                      onChange={(next) => patchGeo3dColor("platformRippleColor", { platformRippleColor: next })}
                    />
                    <DeAttrSliderField
                      label="涟漪不透明度"
                      compact
                      value={geo3d.platformRippleOpacity}
                      fallback={DEFAULT_PLATFORM_RIPPLE_OPACITY}
                      min={0}
                      max={1}
                      step={0.05}
                      ariaLabel="底座涟漪不透明度"
                      onChange={(platformRippleOpacity) => patchGeo3d({ platformRippleOpacity })}
                    />
                    <DeAttrSliderField
                      label="涟漪速度"
                      compact
                      value={geo3d.platformRippleSpeed}
                      fallback={DEFAULT_PLATFORM_RIPPLE_SPEED}
                      min={0.2}
                      max={3}
                      step={0.1}
                      ariaLabel="底座涟漪扩散速度"
                      onChange={(platformRippleSpeed) => patchGeo3d({ platformRippleSpeed })}
                    />
                    <DeAttrSliderField
                      label="涟漪频率"
                      compact
                      value={geo3d.platformRippleFrequency}
                      fallback={DEFAULT_PLATFORM_RIPPLE_FREQUENCY}
                      min={1}
                      max={5}
                      step={1}
                      ariaLabel="底座涟漪波数"
                      onChange={(platformRippleFrequency) => patchGeo3d({ platformRippleFrequency })}
                    />
                  </>
                ) : null}
                <InspectorSwitchRow
                  label="径向光晕"
                  checked={platformGlowOn}
                  onCheckedChange={(platformGlow) => patchGeo3d({ platformGlow })}
                />
                {platformGlowOn ? (
                  <>
                    <InspectorInlineColorRow
                      label="光晕颜色"
                      value={resolvePlatformGlowColorHex(geo3d, borderColorPreset, isDarkTheme)}
                      fallbackValue={resolvePlatformGlowColorHex(
                        { ...geo3d, platformGlowColor: undefined },
                        borderColorPreset,
                        isDarkTheme,
                      )}
                      allowClear={hasCustomPlatformGlowColor(geo3d)}
                      swatches={WIDGET_BORDER_RECOMMENDED}
                      onChange={(next) => patchGeo3dColor("platformGlowColor", { platformGlowColor: next })}
                    />
                    <DeAttrSliderField
                      label="光晕不透明度"
                      compact
                      value={geo3d.platformGlowOpacity}
                      fallback={DEFAULT_PLATFORM_GLOW_OPACITY}
                      min={0}
                      max={1}
                      step={0.05}
                      ariaLabel="底座光晕不透明度"
                      onChange={(platformGlowOpacity) => patchGeo3d({ platformGlowOpacity })}
                    />
                  </>
                ) : null}
                <InspectorSwitchRow
                  label="脉冲波"
                  checked={platformPulseOn}
                  onCheckedChange={(platformPulse) => patchGeo3d({ platformPulse })}
                />
                {platformPulseOn ? (
                  <>
                    <InspectorInlineColorRow
                      label="脉冲颜色"
                      value={resolvePlatformPulseColorHex(geo3d, borderColorPreset, isDarkTheme)}
                      fallbackValue={resolvePlatformPulseColorHex(
                        { ...geo3d, platformPulseColor: undefined },
                        borderColorPreset,
                        isDarkTheme,
                      )}
                      allowClear={hasCustomPlatformPulseColor(geo3d)}
                      swatches={WIDGET_BORDER_RECOMMENDED}
                      onChange={(next) => patchGeo3dColor("platformPulseColor", { platformPulseColor: next })}
                    />
                    <DeAttrSliderField
                      label="脉冲不透明度"
                      compact
                      value={geo3d.platformPulseOpacity}
                      fallback={DEFAULT_PLATFORM_PULSE_OPACITY}
                      min={0}
                      max={1}
                      step={0.05}
                      ariaLabel="底座脉冲不透明度"
                      onChange={(platformPulseOpacity) => patchGeo3d({ platformPulseOpacity })}
                    />
                    <DeAttrSliderField
                      label="脉冲速度"
                      compact
                      value={geo3d.platformPulseSpeed}
                      fallback={DEFAULT_PLATFORM_PULSE_SPEED}
                      min={0.2}
                      max={3}
                      step={0.1}
                      ariaLabel="底座脉冲波速度"
                      onChange={(platformPulseSpeed) => patchGeo3d({ platformPulseSpeed })}
                    />
                  </>
                ) : null}
                <InspectorSwitchRow
                  label="旋转扫光"
                  checked={platformSweepOn}
                  onCheckedChange={(platformSweep) => patchGeo3d({ platformSweep })}
                />
                {platformSweepOn ? (
                  <>
                    <InspectorInlineColorRow
                      label="扫光颜色"
                      value={resolvePlatformSweepColorHex(geo3d, borderColorPreset, isDarkTheme)}
                      fallbackValue={resolvePlatformSweepColorHex(
                        { ...geo3d, platformSweepColor: undefined },
                        borderColorPreset,
                        isDarkTheme,
                      )}
                      allowClear={hasCustomPlatformSweepColor(geo3d)}
                      swatches={WIDGET_BORDER_RECOMMENDED}
                      onChange={(next) => patchGeo3dColor("platformSweepColor", { platformSweepColor: next })}
                    />
                    <DeAttrSliderField
                      label="扫光不透明度"
                      compact
                      value={geo3d.platformSweepOpacity}
                      fallback={DEFAULT_PLATFORM_SWEEP_OPACITY}
                      min={0}
                      max={1}
                      step={0.05}
                      ariaLabel="底座扫光不透明度"
                      onChange={(platformSweepOpacity) => patchGeo3d({ platformSweepOpacity })}
                    />
                    <DeAttrSliderField
                      label="扫光速度"
                      compact
                      value={geo3d.platformSweepSpeed}
                      fallback={DEFAULT_PLATFORM_SWEEP_SPEED}
                      min={0.2}
                      max={3}
                      step={0.1}
                      ariaLabel="底座旋转扫光速度"
                      onChange={(platformSweepSpeed) => patchGeo3d({ platformSweepSpeed })}
                    />
                  </>
                ) : null}
                {(platformHighlightOn || platformRingsOn) ? (
                  <DeAttrSliderField
                    label="环尺寸"
                    compact
                    value={geo3d.platformSizeScale}
                    fallback={DEFAULT_PLATFORM_SIZE_SCALE}
                    min={0.4}
                    max={1.6}
                    step={0.05}
                    ariaLabel="底座环尺寸倍率"
                    onChange={(platformSizeScale) => patchGeo3d({ platformSizeScale })}
                  />
                ) : null}
              </>
            ) : null}
            <InspectorSwitchRow
              label="点位特效"
              checked={pointEffectsOn}
              onCheckedChange={(pointEffects) => patchGeo3d({ pointEffects })}
            />
            {pointEffectsOn ? (
              <>
                <InspectorSwitchRow
                  label="贴地热力"
                  checked={heatBlobOn}
                  onCheckedChange={(heatBlob) => patchGeo3d({ heatBlob })}
                />
                {heatBlobOn ? (
                  <>
                    <DeAttrSliderField
                      label="热力不透明度"
                      compact
                      value={geo3d.heatBlobOpacity}
                      fallback={DEFAULT_HEAT_BLOB_OPACITY}
                      min={0}
                      max={1}
                      step={0.05}
                      ariaLabel="贴地热力不透明度"
                      onChange={(heatBlobOpacity) => patchGeo3d({ heatBlobOpacity })}
                    />
                    <DeAttrSliderField
                      label="热力半径"
                      compact
                      value={geo3d.heatBlobRadius}
                      fallback={DEFAULT_HEAT_BLOB_RADIUS}
                      min={MIN_HEAT_BLOB_RADIUS}
                      max={MAX_HEAT_BLOB_RADIUS}
                      step={1}
                      ariaLabel="贴地热力半径"
                      onChange={(heatBlobRadius) => patchGeo3d({ heatBlobRadius })}
                    />
                    <DeAttrSliderField
                      label="热力模糊"
                      compact
                      value={geo3d.heatBlobBlur}
                      fallback={DEFAULT_HEAT_BLOB_BLUR}
                      min={0.5}
                      max={2}
                      step={0.1}
                      ariaLabel="贴地热力模糊"
                      onChange={(heatBlobBlur) => patchGeo3d({ heatBlobBlur })}
                    />
                    <DeAttrSliderField
                      label="热力抬升"
                      compact
                      value={geo3d.heatBlobLift}
                      fallback={DEFAULT_HEAT_BLOB_LIFT}
                      min={0}
                      max={12}
                      step={0.2}
                      ariaLabel="贴地热力抬升"
                      onChange={(heatBlobLift) => patchGeo3d({ heatBlobLift })}
                    />
                    <DeAttrSliderField
                      label="弱化顶面着色"
                      compact
                      value={geo3d.heatBlobDimChoropleth}
                      fallback={DEFAULT_HEAT_BLOB_DIM_CHOROPLETH}
                      min={0}
                      max={1}
                      step={0.05}
                      ariaLabel="热力开启时弱化顶面着色"
                      onChange={(heatBlobDimChoropleth) => patchGeo3d({ heatBlobDimChoropleth })}
                    />
                    <InspectorInlineColorRow
                      label="热力乘色"
                      hint="贴地热力按数据行地区/经纬度落点（同位置自动求和）；光柱与浮动标签仍按当前地图层级行政区显示。"
                      value={geo3d.heatBlobColor ?? DEFAULT_HEAT_BLOB_COLOR}
                      fallbackValue={DEFAULT_HEAT_BLOB_COLOR}
                      allowClear={hasCustomHeatBlobColor(geo3d)}
                      swatches={WIDGET_BORDER_RECOMMENDED}
                      onChange={(next) => patchGeo3dColor("heatBlobColor", { heatBlobColor: next })}
                    />
                  </>
                ) : null}
                <InspectorSwitchRow
                  label="垂直光柱"
                  checked={pointPillarOn}
                  onCheckedChange={(pointPillar) => patchGeo3d({ pointPillar })}
                />
                {pointPillarOn ? (
                  <>
                    <InspectorInlineColorRow
                      label="光柱顶色"
                      value={geo3d.pointPillarColorTop ?? DEFAULT_POINT_PILLAR_COLOR_TOP}
                      fallbackValue={DEFAULT_POINT_PILLAR_COLOR_TOP}
                      allowClear={hasCustomPointPillarColorTop(geo3d)}
                      swatches={WIDGET_BORDER_RECOMMENDED}
                      onChange={(next) => patchGeo3dColor("pointPillarColorTop", { pointPillarColorTop: next })}
                    />
                    <InspectorInlineColorRow
                      label="光柱底色"
                      value={geo3d.pointPillarColorBottom ?? DEFAULT_POINT_PILLAR_COLOR_BOTTOM}
                      fallbackValue={DEFAULT_POINT_PILLAR_COLOR_BOTTOM}
                      allowClear={hasCustomPointPillarColorBottom(geo3d)}
                      swatches={WIDGET_BORDER_RECOMMENDED}
                      onChange={(next) => patchGeo3dColor("pointPillarColorBottom", { pointPillarColorBottom: next })}
                    />
                    <DeAttrSliderField
                      label="光柱不透明度"
                      compact
                      value={geo3d.pointPillarOpacity}
                      fallback={DEFAULT_POINT_PILLAR_OPACITY}
                      min={0}
                      max={1}
                      step={0.05}
                      ariaLabel="垂直光柱不透明度"
                      onChange={(pointPillarOpacity) => patchGeo3d({ pointPillarOpacity })}
                    />
                    <DeAttrSliderField
                      label="光柱高度"
                      compact
                      value={geo3d.pointPillarHeightScale}
                      fallback={DEFAULT_POINT_PILLAR_HEIGHT_SCALE}
                      min={1}
                      max={12}
                      step={0.2}
                      ariaLabel="垂直光柱高度倍率"
                      onChange={(pointPillarHeightScale) => patchGeo3d({ pointPillarHeightScale })}
                    />
                    <DeAttrSliderField
                      label="脚底环大小"
                      compact
                      value={geo3d.pointPillarBaseRingScale}
                      fallback={DEFAULT_POINT_PILLAR_BASE_RING_SCALE}
                      min={0.3}
                      max={2.5}
                      step={0.1}
                      ariaLabel="光柱脚底环大小倍率"
                      onChange={(pointPillarBaseRingScale) =>
                        patchGeo3d({ pointPillarBaseRingScale })
                      }
                    />
                    <DeAttrSliderField
                      label="脚底环不透明度"
                      compact
                      value={geo3d.pointPillarBaseRingOpacity}
                      fallback={DEFAULT_POINT_PILLAR_BASE_RING_OPACITY}
                      min={0}
                      max={1}
                      step={0.05}
                      ariaLabel="光柱脚底环不透明度"
                      onChange={(pointPillarBaseRingOpacity) =>
                        patchGeo3d({ pointPillarBaseRingOpacity })
                      }
                    />
                    <DeAttrSliderField
                      label="脚底环速度"
                      compact
                      value={geo3d.pointPillarRingSpeed}
                      fallback={DEFAULT_POINT_PILLAR_RING_SPEED}
                      min={0.2}
                      max={3}
                      step={0.1}
                      ariaLabel="光柱脚底环旋转速度"
                      onChange={(pointPillarRingSpeed) => patchGeo3d({ pointPillarRingSpeed })}
                    />
                  </>
                ) : null}
                <InspectorSwitchRow
                  label="浮动标签"
                  checked={floatingLabelsOn}
                  onCheckedChange={(floatingLabels) => patchGeo3d({ floatingLabels })}
                />
                {floatingLabelsOn ? (
                  <>
                    <ChartPaletteFontSizeSelect
                      density="narrow"
                      value={geo3d.floatingLabelFontSize}
                      fallback={DEFAULT_FLOATING_LABEL_FONT_SIZE}
                      onChange={(floatingLabelFontSize) => patchGeo3d({ floatingLabelFontSize })}
                    />
                    <InspectorInlineColorRow
                      label="标签文字色"
                      value={geo3d.floatingLabelTextColor ?? DEFAULT_FLOATING_LABEL_TEXT_COLOR}
                      fallbackValue={DEFAULT_FLOATING_LABEL_TEXT_COLOR}
                      allowClear={hasCustomFloatingLabelTextColor(geo3d)}
                      swatches={WIDGET_BORDER_RECOMMENDED}
                      onChange={(next) => patchGeo3dColor("floatingLabelTextColor", { floatingLabelTextColor: next })}
                    />
                    <InspectorInlineColorRow
                      label="标签背景色"
                      value={geo3d.floatingLabelBgColor ?? DEFAULT_FLOATING_LABEL_BG_COLOR}
                      fallbackValue={DEFAULT_FLOATING_LABEL_BG_COLOR}
                      allowClear={hasCustomFloatingLabelBgColor(geo3d)}
                      swatches={WIDGET_BORDER_RECOMMENDED}
                      onChange={(next) => patchGeo3dColor("floatingLabelBgColor", { floatingLabelBgColor: next })}
                    />
                    <InspectorInlineColorRow
                      label="标签边框色"
                      value={geo3d.floatingLabelBorderColor ?? DEFAULT_FLOATING_LABEL_BORDER_COLOR}
                      fallbackValue={DEFAULT_FLOATING_LABEL_BORDER_COLOR}
                      allowClear={hasCustomFloatingLabelBorderColor(geo3d)}
                      swatches={WIDGET_BORDER_RECOMMENDED}
                      onChange={(next) => patchGeo3dColor("floatingLabelBorderColor", { floatingLabelBorderColor: next })}
                    />
                    <DeAttrSliderField
                      label="标签偏移"
                      compact
                      value={geo3d.floatingLabelOffset}
                      fallback={DEFAULT_FLOATING_LABEL_OFFSET}
                      min={0}
                      max={2}
                      step={0.05}
                      ariaLabel="浮动标签柱顶偏移"
                      onChange={(floatingLabelOffset) => patchGeo3d({ floatingLabelOffset })}
                    />
                  </>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </ChartInspectorSection>
  );
}
