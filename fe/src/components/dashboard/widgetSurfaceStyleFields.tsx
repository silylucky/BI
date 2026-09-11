import type { ComponentProps } from "react";
import { SURFACE_COLOR_RECOMMENDED, type WidgetStyleConfig } from "./dashboardStyleConfig";
import {
  ChartDeSliderField,
  DashboardConfigGridSlider,
  DashboardConfigSlider,
  InspectorSliderField,
} from "./deAttrSlider";
import { SpacingModeToggle } from "./inspectorSpacing";
import { InspectorInlineColorRow } from "./inspectorCompact";

import type { SurfaceKind } from "@/lib/surfacePreset";

export type WidgetSurfaceStyleDensity = "wide" | "narrow";

type PatchFn = (patch: Partial<WidgetStyleConfig>) => void;

/** 面板滑块 fallback：仪表板 100%，大屏 0% */
export function resolveWidgetShellOpacityFallback(
  surfaceKind?: SurfaceKind,
): number {
  return surfaceKind === "data-screen" ? 0 : 100;
}

/** 组件底 · 外观补充：底色 / 模糊 / 透明度 */
export function WidgetSurfaceAppearanceFields({
  value,
  onChange,
  onPreviewChange,
  disabled = false,
  density = "wide",
  surfaceKind,
}: {
  value: WidgetStyleConfig;
  onChange: PatchFn;
  /** 拖拽预览（与 onChange 相同 patch 语义） */
  onPreviewChange?: PatchFn;
  disabled?: boolean;
  density?: WidgetSurfaceStyleDensity;
  surfaceKind?: SurfaceKind;
}) {
  if (disabled) return null;

  const shellOpacityFallback = resolveWidgetShellOpacityFallback(surfaceKind);
  const hasBackgroundImage =
    Boolean(value?.backgroundImage?.trim()) || value?.backgroundMode === "image";

  const Slider =
    density === "narrow"
      ? (props: ComponentProps<typeof ChartDeSliderField>) => (
          <InspectorSliderField {...props} />
        )
      : DashboardConfigSlider;

  return (
    <>
      <Slider
        label="背景不透明度"
        ariaLabel="背景不透明度"
        value={value.opacity != null ? Math.round(value.opacity * 100) : undefined}
        fallback={shellOpacityFallback}
        min={0}
        max={100}
        step={1}
        unit="%"
        onChange={(opacity) => onChange({ opacity: opacity / 100 })}
      />
      {hasBackgroundImage ? (
        <Slider
          label="底图不透明度"
          ariaLabel="底图不透明度"
          value={
            value.backgroundImageOpacity != null
              ? Math.round(value.backgroundImageOpacity * 100)
              : undefined
          }
          fallback={100}
          min={0}
          max={100}
          step={1}
          unit="%"
          onChange={(opacity) => onChange({ backgroundImageOpacity: opacity / 100 })}
        />
      ) : null}
      <InspectorInlineColorRow
        label="背景色"
        allowClear
        swatches={SURFACE_COLOR_RECOMMENDED}
        value={value.background ?? ""}
        onChange={(background) =>
          onChange({
            ...(background ? { backgroundShow: true } : {}),
            background: background || undefined,
          })
        }
      />
      <Slider
        label="背景模糊"
        value={value.backdropBlur}
        fallback={0}
        min={0}
        max={64}
        step={1}
        unit="px"
        onChange={(backdropBlur) => onChange({ backdropBlur })}
        onPreviewChange={
          onPreviewChange
            ? (backdropBlur) => {
                if (backdropBlur != null) onPreviewChange({ backdropBlur });
              }
            : undefined
        }
      />
      {(value.backdropBlur ?? 0) > 0 ? (
        <p className="pb-1 text-[10px] leading-snug text-gray-400 dark:text-gray-500">
          {value.backgroundImage
            ? "底图模式：模糊作用于组件背景图；数值越大越模糊。"
            : "毛玻璃：模糊组件背后的画布内容，建议配合背景不透明度；数值越大越模糊。"}
        </p>
      ) : value.backgroundMode === "frame" ? (
        <p className="pb-1 text-[10px] leading-snug text-gray-400 dark:text-gray-500">
          作用于组件底色；装饰边框不透明度请在上方「装饰边框」区单独调节。
        </p>
      ) : null}
    </>
  );
}

/** 内边距 + 圆角（统一值 / 分边） */
export function WidgetSurfaceSpacingFields({
  value,
  onChange,
  density = "wide",
}: {
  value: WidgetStyleConfig;
  onChange: PatchFn;
  density?: WidgetSurfaceStyleDensity;
}) {
  const paddingMode = value.paddingMode ?? "unified";
  const radiusMode = value.radiusMode ?? "unified";
  const Slider =
    density === "narrow"
      ? (props: ComponentProps<typeof ChartDeSliderField>) => (
          <InspectorSliderField {...props} />
        )
      : DashboardConfigSlider;
  const GridSlider = DashboardConfigGridSlider;

  return (
    <>
      <SpacingModeToggle
        label="内边距"
        mode={paddingMode}
        onChange={(paddingMode) => onChange({ paddingMode })}
        compact={density === "narrow"}
      />
      {paddingMode === "unified" ? (
        <Slider
          label="内边距"
          value={value.padding}
          fallback={8}
          min={0}
          max={64}
          step={1}
          unit="px"
          onChange={(padding) => onChange({ padding })}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2 [&>*]:min-w-0">
          {(
            [
              ["paddingTop", "上"],
              ["paddingRight", "右"],
              ["paddingBottom", "下"],
              ["paddingLeft", "左"],
            ] as const
          ).map(([key, label]) => (
            <GridSlider
              key={key}
              label={label}
              value={value[key]}
              fallback={8}
              min={0}
              max={64}
              step={1}
              unit="px"
              liveUpdate={density === "narrow"}
              onChange={(next) => onChange({ [key]: next })}
            />
          ))}
        </div>
      )}

      <SpacingModeToggle
        label="圆角"
        mode={radiusMode}
        onChange={(radiusMode) => onChange({ radiusMode })}
        compact={density === "narrow"}
      />
      {radiusMode === "unified" ? (
        <Slider
          label="圆角"
          value={value.borderRadius}
          fallback={8}
          min={0}
          max={48}
          step={1}
          unit="px"
          onChange={(borderRadius) => onChange({ borderRadius })}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2 [&>*]:min-w-0">
          {(
            [
              ["borderRadiusTopLeft", "左上"],
              ["borderRadiusTopRight", "右上"],
              ["borderRadiusBottomLeft", "左下"],
              ["borderRadiusBottomRight", "右下"],
            ] as const
          ).map(([key, label]) => (
            <GridSlider
              key={key}
              label={label}
              value={value[key]}
              fallback={8}
              min={0}
              max={48}
              step={1}
              unit="px"
              liveUpdate={density === "narrow"}
              onChange={(next) => onChange({ [key]: next })}
            />
          ))}
        </div>
      )}
    </>
  );
}
