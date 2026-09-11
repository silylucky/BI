import type { ReactNode } from "react";
import { CanvasEditToolbar } from "@/components/dashboard/CanvasEditToolbar";
import type { PaletteInsertType } from "@/components/dashboard/createLayoutWidget";
import { CollapsedRailTab, RailFoldHeader } from "@/components/dashboard/RailFoldTab";
import { DASHBOARD_EDIT_RAIL_PASS_THROUGH_CLASS, DASHBOARD_EDIT_RAIL_SCROLL_CLIP_CLASS, DASHBOARD_EDIT_RAIL_SHELL_CHROME_CLASS, DASHBOARD_EDIT_RAIL_SHELL_CLASS, dashboardEditRailShellWidthStyle } from "@/components/dashboard/dashboardEditRailLayout";
import { useDashboardEditRailShellWidth } from "@/components/dashboard/useDashboardEditRailShellWidth";
import { WidgetEditRailResizeHandle } from "@/components/dashboard/WidgetEditRailResizeHandle";
import type { ColorScheme } from "@/components/dashboard/dashboardStyleConfig";
import { cn } from "@/lib/utils";

function CanvasShell({
  hint,
  leading,
  actions,
  children,
  className,
  canvasEngine = "grid",
  canvasColorScheme = "light",
  onBlankPointerDown,
}: {
  hint?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  canvasEngine?: "grid" | "pixel";
  canvasColorScheme?: ColorScheme;
  onBlankPointerDown?: () => void;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.02]",
        className,
      )}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-2 py-1 dark:border-white/[0.06]"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onBlankPointerDown?.();
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {leading}
          {hint ? (
            <p
              className="hidden min-w-0 flex-1 truncate text-theme-xs text-gray-500 sm:block dark:text-gray-400"
              data-testid={
                typeof hint === "string" && hint.includes("已选中")
                  ? "canvas-multi-select-hint"
                  : undefined
              }
            >
              {hint}
            </p>
          ) : null}
        </div>
        {actions}
      </div>
      <div
        className={cn(
          "dashboard-canvas-surface min-h-0 flex-1 overflow-hidden",
          canvasEngine === "pixel" ? "p-0" : "p-1",
        )}
        data-dashboard-color-scheme={canvasColorScheme}
      >
        {children}
      </div>
    </section>
  );
}

export type DashboardEditWorkspaceProps = {
  onPaletteInsert: (type: PaletteInsertType) => void;
  onOpenReuse?: () => void;
  onOpenPublishToLibrary?: () => void;
  publishToLibraryDisabled?: boolean;
  onOpenDashboardStyle?: () => void;
  canvas: ReactNode;
  chartRail: ReactNode;
  widgetCount?: number;
  multiSelectCount?: number;
  canvasEngine?: "grid" | "pixel";
  canvasActions?: ReactNode;
  /** 右侧配置轨展开（未选中时建议 false，画布占满） */
  chartRailOpen?: boolean;
  onChartRailOpenChange?: (open: boolean) => void;
  chartRailLabel?: string;
  /** 未选中看板上下文时显示外层「收回」顶栏 */
  showRailFoldHeader?: boolean;
  /** 编辑点阵 chrome 随看板 colorScheme，不随 Admin 壳层主题 */
  canvasColorScheme?: ColorScheme;
  /** 点击画布区顶栏空白时切回仪表板配置 */
  onActivateDashboardContext?: () => void;
  /** 编辑区「更多」辅助对齐网格（与仪表板配置 chrome.showAuxiliaryGrid 联动） */
  showAuxiliaryGrid?: boolean;
  onAuxiliaryGridChange?: (enabled: boolean) => void;
  /** 数据大屏：工具栏展示装饰组件 */
  showScreenVisualAssets?: boolean;
  className?: string;
};

export function DashboardEditWorkspace({
  onPaletteInsert,
  onOpenReuse,
  onOpenPublishToLibrary,
  publishToLibraryDisabled,
  onOpenDashboardStyle,
  canvas,
  chartRail,
  widgetCount = 0,
  multiSelectCount = 0,
  canvasEngine = "grid",
  canvasActions,
  chartRailOpen = true,
  onChartRailOpenChange,
  chartRailLabel = "仪表板配置",
  showRailFoldHeader = true,
  canvasColorScheme = "light",
  onActivateDashboardContext,
  showAuxiliaryGrid,
  onAuxiliaryGridChange,
  showScreenVisualAssets = false,
  className,
}: DashboardEditWorkspaceProps) {
  const { railWidthPx, onShellResizePointerDown } = useDashboardEditRailShellWidth();

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 gap-0 overflow-hidden [&>*]:min-h-0",
        className,
      )}
    >
      <CanvasShell
        className="min-h-0 min-w-0 flex-1"
        leading={
          <CanvasEditToolbar
            onInsert={onPaletteInsert}
            onOpenReuse={onOpenReuse}
            onOpenPublishToLibrary={onOpenPublishToLibrary}
            publishToLibraryDisabled={publishToLibraryDisabled}
            onOpenDashboardStyle={onOpenDashboardStyle}
            showScreenVisualAssets={showScreenVisualAssets}
            showAuxiliaryGrid={showAuxiliaryGrid}
            onAuxiliaryGridChange={onAuxiliaryGridChange}
          />
        }
        hint={
          multiSelectCount >= 2
            ? `已选中 ${multiSelectCount} 个组件`
            : widgetCount === 0
              ? "拖拽组件到画布"
              : undefined
        }
        actions={canvasActions}
        canvasEngine={canvasEngine}
        canvasColorScheme={canvasColorScheme}
        onBlankPointerDown={onActivateDashboardContext}
      >
        {canvas}
      </CanvasShell>

      {chartRailOpen ? (
        <>
          <WidgetEditRailResizeHandle
            onPointerDown={onShellResizePointerDown}
            className="w-1 shrink-0 -mx-px"
            ariaLabel="调整画布与配置栏宽度"
            testId="dashboard-edit-rail-shell-resize-handle"
          />
          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-col overflow-hidden",
              DASHBOARD_EDIT_RAIL_SHELL_CHROME_CLASS,
              DASHBOARD_EDIT_RAIL_SHELL_CLASS,
            )}
            style={dashboardEditRailShellWidthStyle(railWidthPx)}
            data-testid="dashboard-edit-rail-shell"
          >
          {showRailFoldHeader && onChartRailOpenChange ? (
            <RailFoldHeader
              label={chartRailLabel}
              onCollapse={() => onChartRailOpenChange(false)}
            />
          ) : null}
          <div className={cn(DASHBOARD_EDIT_RAIL_SCROLL_CLIP_CLASS)}>
            <div
              className={cn(DASHBOARD_EDIT_RAIL_PASS_THROUGH_CLASS)}
              data-testid="dashboard-edit-rail-scroll"
            >
              {chartRail}
            </div>
          </div>
          </div>
        </>
      ) : (
        <CollapsedRailTab
          label={chartRailLabel}
          onExpand={() => onChartRailOpenChange?.(true)}
        />
      )}
    </div>
  );
}
