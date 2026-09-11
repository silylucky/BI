import { cn } from "@/lib/utils";
import { getScreenIconCatalog, SCREEN_SHAPE_OPTIONS } from "@/lib/screenMaterialCatalog";
import type { ScreenIconStyleConfig, ScreenShapeKind, ScreenShapeStyleConfig } from "@/lib/screenVisualStyle";
import {
  DEFAULT_SCREEN_ICON_STYLE,
  normalizeScreenIconStyle,
  normalizeScreenShapeStyle,
} from "@/lib/screenVisualStyle";
import { ChartPaletteFontSizeSelect } from "@/components/dashboard/chartPaletteShared";
import {
  DeAttrField,
  DeSegmentGroup,
} from "@/components/dashboard/dashboardInspectorUi";
import { DeAttrSliderField } from "@/components/dashboard/deAttrSlider";
import { ChartInspectorSection } from "@/components/dashboard/inspectorCompact";
import { resolveScreenIcon } from "./ScreenIconDisplay";
import { ScreenColorField } from "./ScreenVisualStylePanels";

type ScreenStylePanelProps<T> = {
  value: T;
  onChange: (next: T) => void;
};

/** 大屏图标尺寸档位（16–128） */
const SCREEN_ICON_SIZE_OPTIONS = [16, 20, 24, 28, 32, 40, 48, 56, 64, 72, 80, 96, 112, 128] as const;

export function ScreenShapeStylePanel({
  value,
  onChange,
}: ScreenStylePanelProps<ScreenShapeStyleConfig>) {
  const style = normalizeScreenShapeStyle(value);
  const patch = (partial: Partial<ScreenShapeStyleConfig>) => onChange({ ...style, ...partial });

  return (
    <ChartInspectorSection title="图形" defaultOpen data-testid="screen-shape-style-panel">
      <DeAttrField label="图形类型" compact className="border-b-0 py-0">
        <DeSegmentGroup
          value={style.shape}
          options={SCREEN_SHAPE_OPTIONS.map((shape) => ({
            value: shape.id,
            label: shape.label,
          }))}
          columns={3}
          onChange={(next) => patch({ shape: next as ScreenShapeKind })}
        />
      </DeAttrField>
      <ScreenColorField label="描边颜色" value={style.strokeColor} onChange={(strokeColor) => patch({ strokeColor })} />
      <DeAttrSliderField
        label="描边宽度"
        compact
        value={style.strokeWidth}
        min={1}
        max={12}
        step={1}
        ariaLabel="描边宽度"
        onChange={(strokeWidth) => patch({ strokeWidth })}
      />
      <DeAttrSliderField
        label="填充透明度"
        compact
        value={style.fillOpacity}
        min={0}
        max={1}
        step={0.05}
        ariaLabel="填充透明度"
        onChange={(fillOpacity) => patch({ fillOpacity })}
      />
    </ChartInspectorSection>
  );
}

export function ScreenIconStylePanel({
  value,
  onChange,
}: ScreenStylePanelProps<ScreenIconStyleConfig>) {
  const style = normalizeScreenIconStyle(value);
  const patch = (partial: Partial<ScreenIconStyleConfig>) => onChange({ ...style, ...partial });

  return (
    <ChartInspectorSection title="图标" defaultOpen data-testid="screen-icon-style-panel">
      <DeAttrField label="图标" compact className="border-b-0 py-0">
        <div className="grid max-h-44 grid-cols-6 gap-0.5 overflow-y-auto rounded-lg bg-gray-100 p-1 dark:bg-white/[0.06]">
          {getScreenIconCatalog().map((entry) => {
            const selected = style.icon === entry.name;
            const Icon = resolveScreenIcon(entry.name);
            return (
              <button
                key={entry.name}
                type="button"
                title={entry.label}
                onClick={() => patch({ icon: entry.name })}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md transition-all",
                  selected
                    ? "bg-white text-brand-600 shadow-theme-xs dark:bg-gray-900 dark:text-brand-300"
                    : "text-gray-600 hover:bg-white/70 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.04] dark:hover:text-gray-200",
                )}
                aria-label={entry.label}
                aria-pressed={selected}
                data-testid={`icon-preset-${entry.name}`}
              >
                <Icon className="size-4" strokeWidth={1.5} aria-hidden />
              </button>
            );
          })}
        </div>
      </DeAttrField>
      <ScreenColorField label="图标颜色" value={style.color} onChange={(color) => patch({ color })} />
      <ChartPaletteFontSizeSelect
        label="图标尺寸"
        density="narrow"
        value={style.size}
        fallback={DEFAULT_SCREEN_ICON_STYLE.size}
        options={SCREEN_ICON_SIZE_OPTIONS}
        onChange={(size) => patch({ size })}
      />
    </ChartInspectorSection>
  );
}
