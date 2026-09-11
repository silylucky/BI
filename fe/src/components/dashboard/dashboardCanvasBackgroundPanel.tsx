import { useState } from "react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { DeAttrField, DeAttrForm } from "./dashboardInspectorUi";
import { INSPECTOR_SWITCH_SIZE } from "./inspectorCompact";
import { ColorField } from "@/components/ui/color-field";
import { WidgetBackgroundImagePicker } from "./WidgetBackgroundImagePicker";
import {
  CANVAS_BG_RECOMMENDED,
  SURFACE_COLOR_RECOMMENDED,
  TEXT_COLOR_RECOMMENDED,
  CANVAS_TILE_DECOR_PRESETS,
  decorPresetThumbStyle,
  patchChromeHideAuxiliaryGrid,
  patchDecorPresetStyle,
  resolveCanvasDecorPresetId,
  resolveCanvasDecorPresetIdForPanel,
  type DashboardStyleConfig,
} from "./dashboardStyleConfig";

import type { DashboardStylePatch } from "./DashboardContextInspector";

type PatchFn = (patch: DashboardStylePatch) => void;

type DashboardCanvasBackgroundPanelProps = {
  styleConfig: DashboardStyleConfig;
  patchStyle: PatchFn;
  /** @deprecated 素材库已与组件底图统一，不再按布局区分 */
  isPixelLayout?: boolean;
};

export function DashboardCanvasBackgroundPanel({
  styleConfig,
  patchStyle,
}: DashboardCanvasBackgroundPanelProps) {
  const hasCustomImage = Boolean(styleConfig.canvasBackgroundImage?.trim());
  const [customImageEnabled, setCustomImageEnabled] = useState(
    () => hasCustomImage || resolveCanvasDecorPresetId(styleConfig) === "custom",
  );
  const decorId = resolveCanvasDecorPresetIdForPanel(styleConfig);
  const colorScheme = styleConfig.colorScheme ?? "light";
  const underlay =
    styleConfig.canvasBackgroundCustom && styleConfig.canvasBackground?.trim()
      ? styleConfig.canvasBackground.trim()
      : undefined;
  const imageUrl = styleConfig.canvasBackgroundImage ?? "";

  const commitImageUrl = (next: string) => {
    const trimmed = next.trim();
    patchStyle({
      canvasBackgroundImage: trimmed || undefined,
      canvasBackgroundCustom: Boolean(trimmed),
      canvasDecorPresetId: trimmed ? "custom" : undefined,
      ...(trimmed
        ? patchChromeHideAuxiliaryGrid(styleConfig)
        : {
            canvasBackgroundImageFit: undefined,
            canvasBackgroundImagePosition: undefined,
          }),
    });
  };

  const handleCustomImageToggle = (enabled: boolean) => {
    setCustomImageEnabled(enabled);
    if (!enabled) {
      commitImageUrl("");
    }
  };

  return (
    <DeAttrForm>
      <DeAttrField label="画布底色">
        <ColorField
          variant="swatch"
          showLabel={false}
          showHintTooltip={false}
          compact
          value={styleConfig.canvasBackground ?? ""}
          swatches={CANVAS_BG_RECOMMENDED}
          onChange={(color) =>
            patchStyle({
              canvasBackground: color,
              canvasBackgroundCustom: Boolean(color),
              ...(color
                ? {}
                : {
                    canvasBackgroundImage: undefined,
                    canvasDecorPresetId: undefined,
                  }),
            })
          }
        />
      </DeAttrField>

      <DeAttrField
        label="背景装饰"
        hint="叠在底色之上，仅展示；不参与对齐/吸附。选纹理时会关闭辅助对齐网格"
      >
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="背景装饰">
          {CANVAS_TILE_DECOR_PRESETS.map((preset) => {
            const selected = decorId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 transition-all",
                  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/30",
                  selected
                    ? "border-brand-500 bg-brand-50/60 shadow-theme-xs dark:border-brand-500 dark:bg-brand-500/10"
                    : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-transparent dark:hover:border-gray-600",
                )}
                aria-pressed={selected}
                onClick={() => {
                  patchStyle(patchDecorPresetStyle(preset.id, styleConfig));
                  setCustomImageEnabled(false);
                }}
              >
                <span
                  className="size-6 shrink-0 rounded-[4px] border border-gray-200/80 dark:border-gray-600"
                  style={decorPresetThumbStyle(preset.id, colorScheme, underlay)}
                  aria-hidden
                />
                <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>
      </DeAttrField>

      <DeAttrField label="自定义背景图" compact>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-theme-xs text-gray-500 dark:text-gray-400">启用自定义图片</span>
            <Switch
              checked={customImageEnabled}
              onCheckedChange={handleCustomImageToggle}
              aria-label="启用自定义背景图"
              size={INSPECTOR_SWITCH_SIZE}
            />
          </div>
          {customImageEnabled ? (
            <WidgetBackgroundImagePicker
              value={{
                backgroundImage: imageUrl,
                backgroundImageFit: styleConfig.canvasBackgroundImageFit,
                backgroundImagePosition: styleConfig.canvasBackgroundImagePosition,
              }}
              onChange={(patch) => {
                if ("backgroundImage" in patch) {
                  commitImageUrl(patch.backgroundImage ?? "");
                  return;
                }
                const fitPatch: DashboardStylePatch = {};
                if ("backgroundImageFit" in patch) {
                  fitPatch.canvasBackgroundImageFit = patch.backgroundImageFit;
                }
                if ("backgroundImagePosition" in patch) {
                  fitPatch.canvasBackgroundImagePosition = patch.backgroundImagePosition;
                }
                if (Object.keys(fitPatch).length > 0) {
                  patchStyle(fitPatch);
                }
              }}
            />
          ) : null}
        </div>
      </DeAttrField>

      <DeAttrField label="弹框背景">
        <ColorField
          variant="swatch"
          showLabel={false}
          showHintTooltip={false}
          compact
          swatches={SURFACE_COLOR_RECOMMENDED}
          value={styleConfig.dialogStyle?.background ?? ""}
          onChange={(color) =>
            patchStyle({ dialogStyle: { ...styleConfig.dialogStyle, background: color } })
          }
        />
      </DeAttrField>
      <DeAttrField label="弹框字体">
        <ColorField
          variant="swatch"
          showLabel={false}
          showHintTooltip={false}
          compact
          swatches={TEXT_COLOR_RECOMMENDED}
          value={styleConfig.dialogStyle?.fontColor ?? ""}
          onChange={(color) =>
            patchStyle({ dialogStyle: { ...styleConfig.dialogStyle, fontColor: color } })
          }
        />
      </DeAttrField>
    </DeAttrForm>
  );
}
