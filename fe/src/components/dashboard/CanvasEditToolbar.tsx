import { forwardRef, useState, type ReactNode } from "react";
import {
  Copy,
  Filter,
  Grid3x3,
  Image,
  LayoutGrid,
  MoreHorizontal,
  Palette,
  PanelsTopLeft,
  Sparkles,
  Type,
  Upload,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { INSPECTOR_SWITCH_SIZE } from "./inspectorCompact";
import { cn } from "@/lib/utils";
import type { PaletteInsertType } from "./createLayoutWidget";
import { ChartPickerPopover } from "./ChartPickerPopover";
import { ChartExploreDrawer } from "./ChartExploreDrawer";
import { QueryComponentPicker } from "./QueryComponentPicker";
import { ScreenMaterialPicker } from "./screen/ScreenMaterialPicker";
import { ScreenMorePicker } from "./screen/ScreenMorePicker";
import { usePaletteDropdownDragLock } from "./paletteDropdownDragLock";

type CanvasEditToolbarProps = {
  onInsert: (type: PaletteInsertType) => void;
  onOpenReuse?: () => void;
  onOpenPublishToLibrary?: () => void;
  publishToLibraryDisabled?: boolean;
  onOpenDashboardStyle?: () => void;
  /** 数据大屏编辑态：展示装饰组件入口 */
  showScreenVisualAssets?: boolean;
  /** 对标 DataEase 编辑区「更多」中的辅助对齐网格快捷开关 */
  showAuxiliaryGrid?: boolean;
  onAuxiliaryGridChange?: (enabled: boolean) => void;
};

const ToolbarNavButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    icon: ReactNode;
    label: string;
    active?: boolean;
    testId?: string;
  }
>(function ToolbarNavButton(
  { icon, label, active, disabled, title, onClick, testId, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      data-testid={testId}
      {...props}
      className={cn(
        "flex min-w-[52px] flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-theme-xs transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200",
        className,
      )}
    >
      <span className="flex size-6 items-center justify-center [&_svg]:size-[18px]">{icon}</span>
      <span className="max-w-[56px] truncate leading-tight">{label}</span>
    </button>
  );
});

/** 对标 DataEase toolbar middle-area */
export function CanvasEditToolbar({
  onInsert,
  onOpenReuse,
  onOpenPublishToLibrary,
  publishToLibraryDisabled = true,
  onOpenDashboardStyle,
  showScreenVisualAssets = false,
  showAuxiliaryGrid = true,
  onAuxiliaryGridChange,
}: CanvasEditToolbarProps) {
  const [chartOpen, setChartOpen] = useState(false);
  const [chartCatalogOpen, setChartCatalogOpen] = useState(false);
  const [queryOpen, setQueryOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const chartDragLock = usePaletteDropdownDragLock();
  const moreDragLock = usePaletteDropdownDragLock();

  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-0.5"
      data-testid="canvas-edit-toolbar"
    >
      <DropdownMenu
        open={chartOpen}
        onOpenChange={(open) => chartDragLock.guardOpenChange(open, setChartOpen)}
        modal={false}
      >
        <DropdownMenuTrigger asChild>
          <ToolbarNavButton
            icon={<LayoutGrid aria-hidden />}
            label="图表"
            active={chartOpen}
            testId="palette-toolbar-toggle"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="bottom"
          sideOffset={8}
          className="w-[min(100vw-2rem,520px)] overflow-hidden p-0"
          data-testid="palette-dropdown-menu"
          onCloseAutoFocus={(e) => e.preventDefault()}
          {...chartDragLock.dismissGuardProps}
        >
          <ChartPickerPopover
            onInsert={onInsert}
            onInsertCustomViz={(payload) => onInsert(payload)}
            onInserted={() => setChartOpen(false)}
            onOpenCatalog={() => {
              setChartOpen(false);
              setChartCatalogOpen(true);
            }}
            onPaletteDragStart={chartDragLock.onDragStart}
            onPaletteDragEnd={chartDragLock.onDragEnd}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      <ChartExploreDrawer open={chartCatalogOpen} onOpenChange={setChartCatalogOpen} />

      <DropdownMenu open={queryOpen} onOpenChange={setQueryOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <ToolbarNavButton
            icon={<Filter aria-hidden />}
            label="查询组件"
            active={queryOpen}
            testId="toolbar-query-toggle"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="bottom"
          sideOffset={8}
          className="w-[min(100vw-2rem,320px)] p-4"
          data-testid="query-dropdown-menu"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <QueryComponentPicker
            onInsert={onInsert}
            onInserted={() => setQueryOpen(false)}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <ToolbarNavButton
        icon={<Type aria-hidden />}
        label="富文本"
        testId="toolbar-insert-text"
        onClick={() => onInsert("text")}
      />

      <ToolbarNavButton
        icon={<Image aria-hidden />}
        label="媒体"
        testId="toolbar-insert-media"
        onClick={() => onInsert("media")}
      />

      <ToolbarNavButton
        icon={<PanelsTopLeft aria-hidden />}
        label="Tab"
        testId="toolbar-insert-tabs"
        onClick={() => onInsert("tabs")}
      />

      {showScreenVisualAssets ? (
        <DropdownMenu open={materialOpen} onOpenChange={setMaterialOpen} modal={false}>
          <DropdownMenuTrigger asChild>
            <ToolbarNavButton
              icon={<Sparkles aria-hidden />}
              label="素材库"
              active={materialOpen}
              testId="toolbar-insert-screen-material"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="bottom"
            sideOffset={8}
            className="w-[min(100vw-2rem,420px)] overflow-hidden p-0"
            data-testid="screen-material-menu"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <ScreenMaterialPicker
              onInsert={onInsert}
              onInserted={() => setMaterialOpen(false)}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <DropdownMenu
        open={moreOpen}
        onOpenChange={(open) => moreDragLock.guardOpenChange(open, setMoreOpen)}
        modal={false}
      >
        <DropdownMenuTrigger asChild>
          <ToolbarNavButton
            icon={<MoreHorizontal aria-hidden />}
            label="更多"
            active={moreOpen}
            testId="toolbar-more-toggle"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="bottom"
          sideOffset={8}
          className={cn(
            "overflow-hidden p-0",
            showScreenVisualAssets ? "w-[min(100vw-2rem,280px)]" : "min-w-[180px]",
          )}
          data-testid="toolbar-more-menu"
          onCloseAutoFocus={(e) => e.preventDefault()}
          {...moreDragLock.dismissGuardProps}
        >
          {showScreenVisualAssets ? (
            <ScreenMorePicker
              onInsert={onInsert}
              onInserted={() => setMoreOpen(false)}
              onPaletteDragStart={moreDragLock.onDragStart}
              onPaletteDragEnd={moreDragLock.onDragEnd}
              extraActions={
                onOpenPublishToLibrary ? (
                  <button
                    type="button"
                    disabled={publishToLibraryDisabled}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-theme-xs text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-white/5"
                    data-testid="toolbar-publish-to-library"
                    onClick={() => {
                      onOpenPublishToLibrary();
                      setMoreOpen(false);
                    }}
                  >
                    <Upload className="size-4 shrink-0" aria-hidden />
                    将选中组件发布到库
                  </button>
                ) : null
              }
            />
          ) : (
            <>
              {onAuxiliaryGridChange ? (
                <DropdownMenuItem
                  className="flex items-center justify-between gap-3"
                  onSelect={(event) => event.preventDefault()}
                  data-testid="toolbar-auxiliary-grid-item"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Grid3x3 className="size-4 shrink-0" aria-hidden />
                    辅助对齐网格
                  </span>
                  <Switch
                    checked={showAuxiliaryGrid}
                    onCheckedChange={onAuxiliaryGridChange}
                    aria-label="辅助对齐网格"
                    size={INSPECTOR_SWITCH_SIZE}
                    className="shrink-0"
                  />
                </DropdownMenuItem>
              ) : null}
              {onOpenPublishToLibrary ? (
                <DropdownMenuItem
                  disabled={publishToLibraryDisabled}
                  onClick={() => {
                    onOpenPublishToLibrary();
                    setMoreOpen(false);
                  }}
                  data-testid="toolbar-publish-to-library"
                >
                  <Upload className="size-4" aria-hidden />
                  将选中组件发布到库
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onClick={() => {
                  onOpenDashboardStyle?.();
                  setMoreOpen(false);
                }}
              >
                <Palette className="size-4" aria-hidden />
                仪表板样式
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ToolbarNavButton
        icon={<Copy aria-hidden />}
        label="复用"
        testId="toolbar-open-reuse"
        onClick={() => onOpenReuse?.()}
      />
    </div>
  );
}
