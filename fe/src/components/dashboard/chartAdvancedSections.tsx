import { Plus, Trash2 } from "lucide-react";
import { TimeRangeConfig } from "@/components/charts/TimeRangeConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { chartInspectorCapabilities } from "@/lib/chartInspectorCapabilities";
import {
  patchChartDeFeatures,
  readChartConditionalRules,
  readChartDeFeatures,
  readChartLinkageConfig,
  readChartMarkLines,
  type ChartConditionalOperator,
  type ChartConditionalRule,
  type ChartLinkageConfig,
  type ChartMarkLine,
} from "@/lib/chartDeFeatures";
import {
  DEFAULT_GEO_MAP_BUBBLE_COLOR,
  DEFAULT_GEO_MAP_BUBBLE_RING_COUNT,
  DEFAULT_GEO_MAP_BUBBLE_SPEED,
  MAX_GEO_MAP_BUBBLE_RING_COUNT,
  MAX_GEO_MAP_BUBBLE_SPEED,
  MIN_GEO_MAP_BUBBLE_RING_COUNT,
  MIN_GEO_MAP_BUBBLE_SPEED,
  hasCustomGeoMapBubbleEffectColor,
  resolveGeoMapBubbleEffectPanelColor,
} from "@/components/charts/engine/geo/geoMapBubbleEffectStyle";
import {
  patchChartDeStyleNested,
  readChartDeStyle,
  readChartGeoStyle,
  resolveEffectivePaletteColors,
} from "@/lib/chartDeStyle";
import { useChartInspector } from "./chartInspectorContext";
import { ChartDeAttrSliderField } from "./deAttrSlider";
import { WIDGET_BORDER_RECOMMENDED } from "./dashboardStyleConfig";
import {
  INSPECTOR_CTRL,
  INSPECTOR_NESTED_CARD,
  INSPECTOR_SECTION_GAP,
  INSPECTOR_SELECT,
  InspectorFieldRow,
  InspectorHintTip,
  InspectorInlineColorRow,
  InspectorSwitchRow,
} from "./inspectorCompact";
import { randomId } from "@/lib/randomId";

function newId(): string {
  return randomId();
}

export function ChartAdvancedFeatureSettings() {
  const { cfg, onChange, columns } = useChartInspector();
  const caps = chartInspectorCapabilities(cfg.chartType);
  const features = readChartDeFeatures(cfg);
  const columnsDisabled = columns.length === 0;

  return (
    <div className={INSPECTOR_SECTION_GAP}>
      {caps.dataZoom ? (
        <InspectorSwitchRow
          label="缩略轴"
          checked={Boolean(features.dataZoom)}
          onCheckedChange={(checked) =>
            onChange(patchChartDeFeatures(cfg, { dataZoom: checked }))
          }
          hint="拖手柄或窗口时主图即时跟随；滚轮平移，Ctrl+滚轮缩放"
          aria-label="缩略轴"
        />
      ) : null}
      {caps.timeRange ? (
        <TimeRangeConfig
          value={cfg.timeRange}
          columns={columns}
          disabled={columnsDisabled}
          dense
          onChange={(timeRange) => onChange({ ...cfg, timeRange })}
        />
      ) : null}
    </div>
  );
}

function MarkLineRow({
  line,
  onChange,
  onRemove,
}: {
  line: ChartMarkLine;
  onChange: (next: ChartMarkLine) => void;
  onRemove: () => void;
}) {
  return (
    <div className={INSPECTOR_NESTED_CARD}>
      <div className="flex items-center justify-between gap-2">
        <InspectorSwitchRow
          label={line.name?.trim() || "辅助线"}
          checked={line.enabled}
          onCheckedChange={(enabled) => onChange({ ...line, enabled })}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-gray-400"
          aria-label="删除辅助线"
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>
      <InspectorFieldRow label="名称">
        <Input
          className={INSPECTOR_CTRL}
          value={line.name ?? ""}
          onChange={(e) => onChange({ ...line, name: e.target.value })}
          placeholder="目标线"
        />
      </InspectorFieldRow>
      <div className="grid grid-cols-2 gap-2">
        <InspectorFieldRow label="轴向">
          <Select
            value={line.axis}
            onValueChange={(v) => onChange({ ...line, axis: v as ChartMarkLine["axis"] })}
          >
            <SelectTrigger className={INSPECTOR_SELECT}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="y">水平 (Y)</SelectItem>
              <SelectItem value="x">垂直 (X)</SelectItem>
            </SelectContent>
          </Select>
        </InspectorFieldRow>
        <InspectorFieldRow label="数值">
          <Input
            type="number"
            className={INSPECTOR_CTRL}
            value={Number.isFinite(line.value) ? line.value : ""}
            onChange={(e) => onChange({ ...line, value: Number(e.target.value) })}
          />
        </InspectorFieldRow>
      </div>
      <InspectorInlineColorRow
        label="颜色"
        value={line.color ?? "#f04438"}
        onChange={(color) => onChange({ ...line, color })}
      />
    </div>
  );
}

export function ChartAdvancedMarkLinesSection() {
  const { cfg, onChange } = useChartInspector();
  const lines = readChartMarkLines(cfg);

  const setLines = (next: ChartMarkLine[]) =>
    onChange(patchChartDeFeatures(cfg, { markLines: next }));

  return (
    <div className={INSPECTOR_SECTION_GAP}>
      {lines.map((line) => (
        <MarkLineRow
          key={line.id}
          line={line}
          onChange={(next) => setLines(lines.map((item) => (item.id === line.id ? next : item)))}
          onRemove={() => setLines(lines.filter((item) => item.id !== line.id))}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-full text-theme-xs"
        onClick={() =>
          setLines([
            ...lines,
            {
              id: newId(),
              enabled: true,
              name: `辅助线 ${lines.length + 1}`,
              axis: "y",
              value: 0,
              color: "#f04438",
              lineStyle: "dashed",
            },
          ])
        }
      >
        <Plus className="mr-1 size-3.5" aria-hidden />
        添加辅助线
      </Button>
    </div>
  );
}

const OPERATOR_OPTIONS: { value: ChartConditionalOperator; label: string }[] = [
  { value: "gt", label: "大于" },
  { value: "gte", label: "大于等于" },
  { value: "lt", label: "小于" },
  { value: "lte", label: "小于等于" },
  { value: "eq", label: "等于" },
];

function ConditionalRuleRow({
  rule,
  onChange,
  onRemove,
}: {
  rule: ChartConditionalRule;
  onChange: (next: ChartConditionalRule) => void;
  onRemove: () => void;
}) {
  return (
    <div className={INSPECTOR_NESTED_CARD}>
      <div className="flex items-center justify-between gap-2">
        <InspectorSwitchRow
          label="规则"
          checked={rule.enabled}
          onCheckedChange={(enabled) => onChange({ ...rule, enabled })}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-gray-400"
          aria-label="删除条件规则"
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <InspectorFieldRow label="比较">
          <Select
            value={rule.operator}
            onValueChange={(v) =>
              onChange({ ...rule, operator: v as ChartConditionalOperator })
            }
          >
            <SelectTrigger className={INSPECTOR_SELECT}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATOR_OPTIONS.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </InspectorFieldRow>
        <InspectorFieldRow label="阈值">
          <Input
            type="number"
            className={INSPECTOR_CTRL}
            value={Number.isFinite(rule.value) ? rule.value : ""}
            onChange={(e) => onChange({ ...rule, value: Number(e.target.value) })}
          />
        </InspectorFieldRow>
      </div>
      <InspectorInlineColorRow
        label="满足时颜色"
        value={rule.color}
        onChange={(color) => onChange({ ...rule, color })}
      />
    </div>
  );
}

export function ChartAdvancedConditionalSection() {
  const { cfg, onChange } = useChartInspector();
  const rules = readChartConditionalRules(cfg);

  const setRules = (next: ChartConditionalRule[]) =>
    onChange(patchChartDeFeatures(cfg, { conditionalRules: next }));

  return (
    <div className={INSPECTOR_SECTION_GAP}>
      {rules.map((rule) => (
        <ConditionalRuleRow
          key={rule.id}
          rule={rule}
          onChange={(next) => setRules(rules.map((item) => (item.id === rule.id ? next : item)))}
          onRemove={() => setRules(rules.filter((item) => item.id !== rule.id))}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-full text-theme-xs"
        disabled={rules.length >= 8}
        onClick={() =>
          setRules([
            ...rules,
            {
              id: newId(),
              enabled: true,
              operator: "gte",
              value: 0,
              color: "#12b76a",
            },
          ])
        }
      >
        <Plus className="mr-1 size-3.5" aria-hidden />
        添加规则
      </Button>
    </div>
  );
}

/** 2D 区域地图 · 高级「联动设置」（对标 DataEase 点击区域联动其他图） */
export function ChartAdvancedMapLinkageSection() {
  const { cfg, onChange, widget, dashboardWidgets = [] } = useChartInspector();
  const linkage = readChartLinkageConfig(cfg);
  const regionField = cfg.dimensions?.[0]?.field?.trim() || "region";

  const patchLinkage = (patch: Partial<ChartLinkageConfig>) =>
    onChange(patchChartDeFeatures(cfg, { linkage: { ...linkage, ...patch } }));

  const chartTargets = dashboardWidgets.filter(
    (item) => item.type === "chart" && item.id !== widget.id,
  );

  const toggleTarget = (widgetId: string, checked: boolean) => {
    const current = linkage.targetWidgetIds ?? [];
    patchLinkage({
      targetWidgetIds: checked
        ? [...current, widgetId]
        : current.filter((id) => id !== widgetId),
    });
  };

  return (
    <div className={INSPECTOR_SECTION_GAP}>
      <InspectorSwitchRow
        label="启用联动"
        checked={linkage.enabled}
        onCheckedChange={(enabled) => patchLinkage({ enabled })}
        hint={
          linkage.enabled
            ? "查看态单击区域将维度值注入目标图表 SQL 参数（与跳转互斥时跳转优先）"
            : "启用后可在查看态点击地图区域联动其他图表"
        }
      />
      {linkage.enabled ? (
        <>
          <InspectorFieldRow
            label="参数键"
            hint="对应 SQL 中 {{region}} 等占位符"
          >
            <Input
              className={INSPECTOR_CTRL}
              value={linkage.parameterKey ?? regionField}
              onChange={(e) => patchLinkage({ parameterKey: e.target.value })}
              placeholder={regionField}
            />
          </InspectorFieldRow>
          <fieldset className="space-y-2">
            <legend className="flex items-center gap-1 text-theme-xs font-medium text-gray-600 dark:text-gray-400">
              目标图表
              <InspectorHintTip text="未勾选时默认联动看板上其余全部图表；目标 SQL 须含对应占位符。" />
            </legend>
            <div className="space-y-0">
              {chartTargets.length > 0 ? (
                chartTargets.map((item) => (
                  <InspectorSwitchRow
                    key={item.id}
                    label={item.title || item.id}
                    checked={(linkage.targetWidgetIds ?? []).includes(item.id)}
                    onCheckedChange={(checked) => toggleTarget(item.id, checked)}
                  />
                ))
              ) : (
                <p className="text-theme-xs text-gray-400">画布上暂无其他图表组件。</p>
              )}
            </div>
          </fieldset>
        </>
      ) : null}
    </div>
  );
}

/** 2D 区域地图 · 高级「气泡动效」（对标 DataEase 水波 / 速率 / 环数） */
export function ChartAdvancedMapBubbleSection() {
  const { cfg, onChange, dashboardStyle } = useChartInspector();
  const deStyle = readChartDeStyle(cfg);
  const geo = readChartGeoStyle(deStyle);
  const enabled = geo.bubbleEffect === true;
  const accentColor = resolveEffectivePaletteColors(
    cfg,
    dashboardStyle?.paletteId,
    dashboardStyle?.paletteColors,
  )[0];
  const bubbleColorFallback = resolveGeoMapBubbleEffectPanelColor({}, { accentColor });

  const patchGeo = (patch: Parameters<typeof patchChartDeStyleNested>[2]) =>
    onChange(patchChartDeStyleNested(cfg, "geo", patch));

  return (
    <div className={INSPECTOR_SECTION_GAP}>
      <InspectorSwitchRow
        label="气泡动效"
        hint="在有数据的区域中心显示扩散水波；速率越高动画越快。"
        checked={enabled}
        onCheckedChange={(bubbleEffect) =>
          patchGeo({
            bubbleEffect,
            ...(bubbleEffect ? { bubbleEffectType: geo.bubbleEffectType ?? "ripple" } : {}),
          })
        }
        aria-label="气泡动效"
      />
      {enabled ? (
        <>
          <InspectorFieldRow label="动效类型">
            <span className="text-theme-xs text-gray-600 dark:text-gray-300">水波</span>
          </InspectorFieldRow>
          <InspectorInlineColorRow
            label="水波颜色"
            value={resolveGeoMapBubbleEffectPanelColor(geo, { accentColor })}
            fallbackValue={bubbleColorFallback}
            allowClear={hasCustomGeoMapBubbleEffectColor(geo)}
            swatches={WIDGET_BORDER_RECOMMENDED}
            onChange={(next) => patchGeo({ bubbleEffectColor: next })}
          />
          <ChartDeAttrSliderField
            label="动效速率"
            compact
            value={geo.bubbleEffectSpeed}
            fallback={DEFAULT_GEO_MAP_BUBBLE_SPEED}
            min={MIN_GEO_MAP_BUBBLE_SPEED}
            max={MAX_GEO_MAP_BUBBLE_SPEED}
            step={0.1}
            ariaLabel="动效速率"
            onChange={(bubbleEffectSpeed) => patchGeo({ bubbleEffectSpeed })}
          />
          <ChartDeAttrSliderField
            label="水波环数"
            compact
            value={geo.bubbleEffectRingCount}
            fallback={DEFAULT_GEO_MAP_BUBBLE_RING_COUNT}
            min={MIN_GEO_MAP_BUBBLE_RING_COUNT}
            max={MAX_GEO_MAP_BUBBLE_RING_COUNT}
            step={0.1}
            ariaLabel="水波环数"
            onChange={(bubbleEffectRingCount) => patchGeo({ bubbleEffectRingCount })}
          />
        </>
      ) : null}
    </div>
  );
}

export { ChartAdvancedMapAreaMappingSection } from "./ChartGeoAreaMappingPanel";
