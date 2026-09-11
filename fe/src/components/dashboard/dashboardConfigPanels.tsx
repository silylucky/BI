import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardConfigSection } from "./DashboardConfigSection";
import {
  formatMetricValue,
  TEXT_COLOR_RECOMMENDED,
  type ColorScheme,
  type DashboardStyleConfig,
} from "./dashboardStyleConfig";
import { InspectorInlineColorRow, InspectorSwitchRow } from "./inspectorCompact";
import { DashboardCanvasBackgroundPanel } from "./dashboardCanvasBackgroundPanel";
import { DashboardOverallConfigPanel } from "./dashboardOverallConfigPanel";
import { DashboardThemeStylePanel } from "./dashboardThemeStylePanel";
import { DashboardChartTitleStylePanel } from "./dashboardChartTitleStylePanel";
import { DashboardConfigSlider } from "./deAttrSlider";
import { ChartBackgroundStyleFields } from "./chartStyleFields";
import { ChartPaletteDeParityFields } from "./chartPaletteDeParityFields";
import { ChartTableColorFields } from "./chartPaletteLabelTooltipFields";
import {
  resolveChartLabelDisplayColor,
  resolveChartTooltipDisplayBackground,
  resolveChartTooltipDisplayColor,
} from "@/lib/chartDeStyle";
import type { DashboardStylePatch } from "./DashboardContextInspector";

type PatchFn = (patch: DashboardStylePatch) => void;

type StyleSectionProps = {
  styleConfig: DashboardStyleConfig;
  patchStyle: PatchFn;
  isPixelLayout: boolean;
  onSwitchColorScheme?: (scheme: ColorScheme) => void;
  onResetColorsToTheme?: () => void;
};

export function DashboardStyleSections({
  styleConfig,
  patchStyle,
  isPixelLayout,
  onSwitchColorScheme,
  onResetColorsToTheme,
}: StyleSectionProps) {
  const colorScheme = styleConfig.colorScheme ?? "light";

  return (
    <>
      <DashboardConfigSection
        title="仪表板风格"
        defaultOpen
        data-testid="dashboard-theme-section"
      >
        <DashboardThemeStylePanel
          colorScheme={colorScheme}
          onSwitchColorScheme={onSwitchColorScheme}
          onPatchColorScheme={(scheme) => patchStyle({ colorScheme: scheme })}
          onResetColorsToTheme={onResetColorsToTheme}
        />
      </DashboardConfigSection>

      <DashboardConfigSection title="整体配置" data-testid="dashboard-overall-config">
        <DashboardOverallConfigPanel
          styleConfig={styleConfig}
          patchStyle={patchStyle}
          isPixelLayout={isPixelLayout}
        />
      </DashboardConfigSection>

      <DashboardConfigSection title="仪表板背景" data-testid="dashboard-canvas-background">
        <DashboardCanvasBackgroundPanel
          styleConfig={styleConfig}
          patchStyle={patchStyle}
          isPixelLayout={isPixelLayout}
        />
      </DashboardConfigSection>
    </>
  );
}

export function DashboardWidgetStyleSections({
  styleConfig,
  patchStyle,
}: StyleSectionProps) {
  const ws = styleConfig.widgetStyle ?? {};
  const ts = styleConfig.titleStyle ?? {};
  const nf = styleConfig.numberFormat ?? {};
  const fc = styleConfig.filterChromeStyle ?? {};
  const fctrl = styleConfig.filterControlStyle ?? {};

  const patchWidgetStyle = (patch: Partial<typeof ws>) => {
    patchStyle((prev) => {
      const next = { ...(prev.widgetStyle ?? {}), ...patch };
      if (next.backgroundMode === "border" || next.backgroundMode === "image") {
        next.framePresetId = undefined;
        next.frameColor = undefined;
      }
      return { widgetStyle: next };
    });
  };
  const patchTitleStyle = (patch: Partial<typeof ts>) =>
    patchStyle((prev) => ({ titleStyle: { ...prev.titleStyle, ...patch } }));
  const patchNumberFormat = (patch: Partial<typeof nf>) =>
    patchStyle((prev) => ({ numberFormat: { ...prev.numberFormat, ...patch } }));

  return (
    <>
      <DashboardConfigSection
        title="组件外观"
        data-testid="dashboard-widget-chart-style"
      >
        <p className="mb-2 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
          配置图表组件外壳的背景与边框；图表绘图区样式请在选中组件后的「样式」Tab 中调整。
        </p>
        <ChartBackgroundStyleFields
          value={ws}
          onChange={patchWidgetStyle}
          scope="dashboard"
          density="wide"
          showHeaderToggle={false}
          surfaceKind={styleConfig.surfaceKind ?? "dashboard"}
        />
      </DashboardConfigSection>

      <DashboardConfigSection title="图表配色">
        <ChartPaletteDeParityFields
          paletteId={styleConfig.paletteId}
          paletteColors={styleConfig.paletteColors}
          dashboardPaletteId={styleConfig.paletteId}
          dashboardPaletteColors={styleConfig.paletteColors}
          paletteOpacity={styleConfig.paletteOpacity}
          seriesGradient={styleConfig.seriesGradient ?? false}
          depthVisual={styleConfig.depthVisual ?? "off"}
          labelShow={styleConfig.chartLabelShow ?? false}
          tooltipShow={styleConfig.tooltipShow ?? true}
          labelStyle={{
            fontSize: styleConfig.chartLabelStyle?.fontSize ?? 12,
            color: styleConfig.chartLabelStyle?.color,
          }}
          tooltipStyle={{
            fontSize: styleConfig.chartTooltipStyle?.fontSize ?? 12,
            color: styleConfig.chartTooltipStyle?.color,
            background: styleConfig.chartTooltipStyle?.background,
          }}
          labelColorFallback={resolveChartLabelDisplayColor(undefined, styleConfig)}
          tooltipColorFallback={resolveChartTooltipDisplayColor(undefined, styleConfig)}
          tooltipBackgroundFallback={resolveChartTooltipDisplayBackground(undefined, styleConfig)}
          onPaletteChange={(paletteId, colors) =>
            patchStyle({
              paletteId: paletteId ?? "default",
              paletteColors: [...colors],
            })
          }
          onOpacityChange={(opacityPercent) =>
            patchStyle({ paletteOpacity: opacityPercent / 100 })
          }
          onOpacityPreview={(opacityPercent) =>
            patchStyle({ paletteOpacity: opacityPercent / 100 })
          }
          onSeriesGradientChange={(enabled) => patchStyle({ seriesGradient: enabled })}
          onDepthVisualChange={(level) => patchStyle({ depthVisual: level })}
          onLabelShowChange={(show) => patchStyle({ chartLabelShow: show })}
          onTooltipShowChange={(show) => patchStyle({ tooltipShow: show })}
          onLabelStyleChange={(patch) =>
            patchStyle((prev) => ({
              ...(patch.color !== undefined && !(prev.chartLabelShow ?? false)
                ? { chartLabelShow: true }
                : {}),
              chartLabelStyle: { fontSize: 12, ...prev.chartLabelStyle, ...patch },
            }))
          }
          onTooltipStyleChange={(patch) =>
            patchStyle((prev) => ({
              chartTooltipStyle: { fontSize: 12, ...prev.chartTooltipStyle, ...patch },
            }))
          }
          tableColorSection={
            <ChartTableColorFields
              tableStyle={styleConfig.tableColorStyle ?? {}}
              onPatch={(patch) =>
                patchStyle((prev) => ({
                  tableColorStyle: { ...prev.tableColorStyle, ...patch },
                }))
              }
            />
          }
        />
      </DashboardConfigSection>

      <DashboardConfigSection title="图表标题" data-testid="dashboard-chart-title-style">
        <DashboardChartTitleStylePanel titleStyle={ts} onPatch={patchTitleStyle} />
      </DashboardConfigSection>

      <DashboardConfigSection title="查询组件">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-theme-xs text-gray-500">标题位置</Label>
            <Select
              value={fc.titlePosition ?? "top"}
              onValueChange={(v) =>
                patchStyle({ filterChromeStyle: { ...fc, titlePosition: v as "top" | "left" } })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">上方</SelectItem>
                <SelectItem value="left">左侧</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <InspectorInlineColorRow
            label="标题颜色"
            allowClear
            swatches={TEXT_COLOR_RECOMMENDED}
            value={fc.titleColor ?? ""}
            onChange={(color) =>
              patchStyle({ filterChromeStyle: { ...fc, titleColor: color } })
            }
            className="col-span-2"
          />
          <div className="col-span-2">
            <DashboardConfigSlider
              label="控件高度"
              value={fctrl.height}
              fallback={32}
              min={28}
              max={48}
              step={1}
              unit="px"
              onChange={(height) =>
                patchStyle({
                  filterControlStyle: {
                    ...fctrl,
                    height,
                  },
                })
              }
            />
          </div>
          <div className="col-span-2">
            <DashboardConfigSlider
              label="控件圆角"
              value={fctrl.borderRadius}
              fallback={6}
              min={0}
              max={24}
              step={1}
              unit="px"
              onChange={(borderRadius) =>
                patchStyle({
                  filterControlStyle: {
                    ...fctrl,
                    borderRadius,
                  },
                })
              }
            />
          </div>
        </div>
      </DashboardConfigSection>

      <DashboardConfigSection title="数字内容格式" data-testid="dashboard-number-format">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-theme-xs text-gray-500">格式类型</Label>
              <Select
                value={nf.type ?? "auto"}
                onValueChange={(v) =>
                  patchNumberFormat({ type: v as "auto" | "number" | "percent" | "currency" })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">自动</SelectItem>
                  <SelectItem value="number">数值</SelectItem>
                  <SelectItem value="percent">百分比</SelectItem>
                  <SelectItem value="currency">货币</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-theme-xs text-gray-500">单位语言</Label>
              <Select value="zh" disabled>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh">中文</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <DashboardConfigSlider
                label="小数位"
                value={nf.decimals}
                fallback={0}
                min={0}
                max={8}
                step={1}
                onChange={(decimals) => patchNumberFormat({ decimals })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-theme-xs text-gray-500">数量单位</Label>
              <Select
                value={
                  !nf.unit
                    ? "none"
                    : nf.unit === "千" || nf.unit === "万" || nf.unit === "亿"
                      ? nf.unit
                      : "custom"
                }
                onValueChange={(v) => {
                  if (v === "none") patchNumberFormat({ unit: undefined });
                  else if (v === "千" || v === "万" || v === "亿") patchNumberFormat({ unit: v });
                  else patchNumberFormat({ unit: nf.unit ?? "" });
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无</SelectItem>
                  <SelectItem value="千">千</SelectItem>
                  <SelectItem value="万">万</SelectItem>
                  <SelectItem value="亿">亿</SelectItem>
                  <SelectItem value="custom">自定义后缀</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-theme-xs text-gray-500">单位后缀</Label>
            <Input
              className="h-9"
              placeholder="如：元、次"
              value={nf.unit ?? ""}
              onChange={(e) => patchNumberFormat({ unit: e.target.value || undefined })}
            />
          </div>
          <InspectorSwitchRow
            label="千分符"
            checked={nf.thousandSeparator !== false}
            onCheckedChange={(checked) => patchNumberFormat({ thousandSeparator: checked })}
          />
          <p
            className="rounded-md bg-gray-50 px-2.5 py-2 text-theme-xs text-gray-600 dark:bg-white/[0.04] dark:text-gray-400"
            data-testid="dashboard-number-format-preview"
          >
            示例{formatMetricValue(20_000_000, nf)}
          </p>
        </div>
      </DashboardConfigSection>
    </>
  );
}
