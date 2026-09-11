/**
 * StylePipeline — 看板样式 load / edit / preview / save 单一路径（HYD-05 最小落地）。
 * 所有消费方须通过 hydrate / resolveEffective，禁止直接读未 bootstrap 的 layout.styleConfig。
 */

import type { ColorScheme } from "./dashboardStyleConfig";
import {
  buildDashboardLayoutForSave,
  dashboardPersistFingerprint,
  pixelWidgetToLayoutWidget,
  prepareDashboardLayout,
} from "./dashboardCanvasMode";
import { resolveComponentGapRuntime, type CanvasGapMode } from "./componentGapRuntime";
import type {
  DashboardLayout,
  DashboardLayoutV2,
  DashboardStyleConfig,
  LayoutWidget,
} from "./layoutUtils";
import { materializeDecorStyleConfig } from "./dashboardStyleConfig";
import { reconcileTabPaneChildIdsInPixelLayout } from "./layoutUtils";
import {
  bootstrapDashboardStyleConfig,
  syncChartWidgetsForColorScheme,
} from "./dashboardThemeVariants";
import { migrateLayoutChartTypes } from "@/lib/migrateChartTypes";
import { sanitizePixelLayoutGeometry } from "./pixelCanvas/layoutSanitize";

/** load / save / patch 后统一 hydrate（含 gap normalize + theme bundle + decor 物化） */
export function hydrateDashboardStyle(
  input?: DashboardStyleConfig | null,
): DashboardStyleConfig {
  const bootstrapped = bootstrapDashboardStyleConfig(input ?? {});
  const normalizedOpacity =
    bootstrapped.paletteOpacity != null && bootstrapped.paletteOpacity > 1
      ? { ...bootstrapped, paletteOpacity: bootstrapped.paletteOpacity / 100 }
      : bootstrapped;
  return materializeDecorStyleConfig(normalizedOpacity);
}

/** 编辑态 liveStyle 优先；只读/预览可仅传 layout */
export function resolveEffectiveDashboardStyle(
  layout: DashboardLayout,
  liveStyle?: DashboardStyleConfig,
): DashboardStyleConfig {
  // 仅 layout 几何变更时不应反复 bootstrap；以 liveStyle 为准并幂等 hydrate
  return hydrateDashboardStyle(liveStyle ?? layout.styleConfig);
}

export function resolveDashboardGapRuntimeFromLayout(
  layout: DashboardLayout,
  liveStyle?: DashboardStyleConfig,
) {
  const mode: CanvasGapMode = layout.version === 2 ? "pixel" : "grid";
  return resolveComponentGapRuntime(resolveEffectiveDashboardStyle(layout, liveStyle), mode);
}

/** 与 PUT /layout 及 dirty 指纹一致的持久化快照 */
export function persistDashboardLayout(
  layout: DashboardLayout,
  liveStyle: DashboardStyleConfig,
): DashboardLayout {
  const style = hydrateDashboardStyle(liveStyle);
  let layoutForSave = layout;
  if (layout.version === 2) {
    layoutForSave = sanitizePixelLayoutGeometry(layoutForSave, style, { packOverlaps: false });
  }
  return buildDashboardLayoutForSave(layoutForSave, style);
}

/** 加载/预览前：Tab 修复与可选 pack；不在此隐式压实外框坐标 */
export function preparePixelLayoutForDisplay(
  layout: DashboardLayoutV2,
  style?: DashboardStyleConfig | null,
): DashboardLayoutV2 {
  return sanitizePixelLayoutGeometry(layout, style, { packOverlaps: false });
}

export function persistDashboardFingerprint(
  layout: DashboardLayout,
  liveStyle: DashboardStyleConfig,
  pixelEnabled: boolean,
): string {
  return dashboardPersistFingerprint(
    layout,
    hydrateDashboardStyle(liveStyle),
    pixelEnabled,
  );
}

/** 列表卡片预览：与 load 路径一致的 hydrate + 弃用 chartType 迁移 + 图表 deStyle 同步 */
export function prepareLayoutForListPreview(layout: DashboardLayout): DashboardLayout {
  const migrated = migrateLayoutChartTypes(layout) as DashboardLayout;
  const style = hydrateDashboardStyle(migrated.styleConfig);
  let prepared: DashboardLayout = { ...migrated, styleConfig: style };
  if (prepared.version === 2) {
    prepared = syncPixelLayoutChartStyles(prepared, style.colorScheme ?? "light");
    prepared = preparePixelLayoutForDisplay(prepared, style);
  }
  return prepared;
}

/** 与 useDashboardCanvasState.resetLayout 内核对齐后的 layout */
export function layoutAfterEditorReset(
  source: DashboardLayout,
  pixelEnabled: boolean,
): DashboardLayout {
  const prepared = prepareDashboardLayout(source, pixelEnabled);
  if (prepared.layout.version === 2) {
    return reconcileTabPaneChildIdsInPixelLayout(prepared.layout);
  }
  return prepared.layout;
}

/** 持久化 layout hydrate 回编辑态（与 load / save 后 resetLayout 入参一致） */
export function layoutForEditorAfterPersist(
  normalizedLayout: DashboardLayout,
  savedStyle: DashboardStyleConfig,
): DashboardLayout {
  let layout: DashboardLayout = { ...normalizedLayout, styleConfig: savedStyle };
  if (layout.version === 2) {
    layout = syncPixelLayoutChartStyles(layout, savedStyle.colorScheme ?? "light");
    layout = preparePixelLayoutForDisplay(layout, savedStyle);
  }
  return layout;
}

/** resetLayout 后内存态应与该快照一致（写 savedFingerprint 用） */
export function editorResetBaselineSnapshot(
  layoutForEditor: DashboardLayout,
  liveStyle: DashboardStyleConfig,
  pixelEnabled: boolean,
): { fingerprint: string; widgets: LayoutWidget[] } {
  const style = hydrateDashboardStyle(liveStyle);
  const withStyle = { ...layoutForEditor, styleConfig: style };
  const baseline = layoutAfterEditorReset(withStyle, pixelEnabled);
  return editorDirtySnapshot({ ...baseline, styleConfig: style }, style, pixelEnabled);
}

/** 与保存 PUT 及 dirty 判定一致的编辑态快照（避免内存 layout 与持久化形态漂移） */
export function editorDirtySnapshot(
  layout: DashboardLayout,
  liveStyle: DashboardStyleConfig,
  pixelEnabled: boolean,
): { fingerprint: string; widgets: LayoutWidget[] } {
  const persisted = persistDashboardLayout(layout, liveStyle);
  const widgets =
    persisted.version === 1
      ? persisted.widgets
      : persisted.widgets.map(pixelWidgetToLayoutWidget);
  return {
    fingerprint: persistDashboardFingerprint(persisted, liveStyle, pixelEnabled),
    widgets,
  };
}

/** 加载时一次性同步图表 deStyle，避免 resetLayout + setWidgets 双写几何 */
export function syncPixelLayoutChartStyles(
  layout: DashboardLayoutV2,
  scheme: ColorScheme,
): DashboardLayoutV2 {
  const synced = syncChartWidgetsForColorScheme(
    layout.widgets.map(pixelWidgetToLayoutWidget),
    scheme,
  );
  const syncedById = new Map(synced.map((widget) => [widget.id, widget]));
  return {
    ...layout,
    widgets: layout.widgets.map((pixelWidget) => {
      const syncedWidget = syncedById.get(pixelWidget.id);
      if (
        !syncedWidget ||
        syncedWidget.type !== "chart" ||
        !syncedWidget.chartConfig ||
        pixelWidget.type !== "chart"
      ) {
        return pixelWidget;
      }
      if (syncedWidget.chartConfig === pixelWidget.chartConfig) return pixelWidget;
      return { ...pixelWidget, chartConfig: syncedWidget.chartConfig };
    }),
  };
}

/** 加载/保存往返：layout + style → persist → hydrate 后指纹应一致 */
export function dashboardLayoutPersistRoundtrip(
  layout: DashboardLayout,
  liveStyle: DashboardStyleConfig,
  pixelEnabled: boolean,
): { saved: DashboardLayout; fingerprint: string } {
  const saved = persistDashboardLayout(layout, liveStyle);
  const fingerprint = persistDashboardFingerprint(saved, saved.styleConfig ?? {}, pixelEnabled);
  return { saved, fingerprint };
}
