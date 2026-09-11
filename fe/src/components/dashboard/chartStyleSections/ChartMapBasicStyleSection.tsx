import { ChartPaletteConfigFields } from "@/components/dashboard/chartPaletteConfigFields";
import { useChartInspector } from "@/components/dashboard/chartInspectorContext";
import {
  hasCustomGeoRegionFillColor,
  resolveGeoRegionFillColorHex,
} from "@/components/charts/engine/geo/geoRegionFillStyle";
import { resolveInheritPreviewColors } from "@/lib/chartPalette";
import {
  patchChartDeStyleNested,
  patchChartPaletteDeStyle,
  readChartDeStyle,
  readChartGeoStyle,
} from "@/lib/chartDeStyle";
import { WIDGET_BORDER_RECOMMENDED } from "@/components/dashboard/dashboardStyleConfig";
import {
  ChartInspectorSection,
  INSPECTOR_SECTION_GAP,
  InspectorInlineColorRow,
  InspectorSwitchRow,
} from "@/components/dashboard/inspectorCompact";

/** 2D 离线地图 · 基础样式（配色 / 不透明度 / 区块填充 / 缩放按钮；边线在「地图样式」） */
export function ChartMapBasicStyleSection() {
  const { cfg, patchDeStyle, onChange, dashboardStyle } = useChartInspector();
  const deStyle = readChartDeStyle(cfg);
  const geo = readChartGeoStyle(deStyle);
  const isDarkTheme = dashboardStyle?.colorScheme === "dark";

  const patchGeo = (patch: Parameters<typeof patchChartDeStyleNested>[2]) =>
    onChange(patchChartDeStyleNested(cfg, "geo", patch));

  const patchPaletteOpacity = (opacityPercent: number) =>
    patchDeStyle({ paletteOpacity: opacityPercent / 100 });

  const inheritPreviewColors = resolveInheritPreviewColors(
    dashboardStyle?.paletteId,
    dashboardStyle?.paletteColors,
  );

  return (
    <ChartInspectorSection title="基础样式" data-testid="chart-map-basic-style">
      <div className={INSPECTOR_SECTION_GAP}>
        <ChartPaletteConfigFields
          dense
          showInherit
          paletteId={deStyle.paletteId}
          paletteColors={deStyle.paletteColors}
          paletteOpacity={deStyle.paletteOpacity}
          inheritPreviewColors={inheritPreviewColors}
          onPaletteChange={(paletteId, colors) =>
            onChange(patchChartPaletteDeStyle(cfg, paletteId, colors))
          }
          onOpacityChange={patchPaletteOpacity}
          onOpacityPreview={patchPaletteOpacity}
        />
        <InspectorInlineColorRow
          label="地图区块填充"
          value={resolveGeoRegionFillColorHex(geo, isDarkTheme)}
          fallbackValue={resolveGeoRegionFillColorHex({ ...geo, regionFillColor: undefined }, isDarkTheme)}
          allowClear={hasCustomGeoRegionFillColor(geo)}
          swatches={WIDGET_BORDER_RECOMMENDED}
          onChange={(next) => patchGeo({ regionFillColor: next })}
        />
        <InspectorSwitchRow
          label="显示缩放按钮"
          checked={geo.showZoomControl === true}
          onCheckedChange={(showZoomControl) => patchGeo({ showZoomControl })}
        />
      </div>
    </ChartInspectorSection>
  );
}
