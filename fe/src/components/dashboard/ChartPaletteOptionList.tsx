import { Check, ChevronDown } from "lucide-react";
import {
  ChartPaletteSwatchStrip,
  type ChartPaletteSwatchStripProps,
} from "./chartPaletteShared";
import { cn } from "@/lib/utils";
import type { ChartPalettePreset } from "@/lib/chartPalette";

export type PaletteRow =
  | ChartPalettePreset
  | { id: string; label: string; colors: readonly [] };

export function PaletteMenuOption({
  row,
  inherit,
  inheritPreviewColors,
  selected = false,
}: {
  row: PaletteRow;
  inherit?: boolean;
  inheritPreviewColors?: ChartPaletteSwatchStripProps["inheritPreviewColors"];
  selected?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <div className="min-w-0 flex-1">
        <ChartPaletteSwatchStrip
          colors={row.colors}
          inherit={inherit}
          inheritPreviewColors={inheritPreviewColors}
          className="rounded-[2px]"
        />
        <span className="mt-1 block w-full text-left text-theme-xs leading-tight text-gray-700 dark:text-gray-300">
          {row.label}
        </span>
      </div>
      <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center">
        {selected ? (
          <Check
            className="size-3.5 stroke-[2.5] text-brand-500 dark:text-brand-400"
            aria-hidden
          />
        ) : null}
      </span>
    </div>
  );
}

type ChartPaletteInlineMenuProps = {
  rows: readonly PaletteRow[];
  selectedId: string;
  inheritValue: string;
  inheritPreviewColors?: ChartPaletteSwatchStripProps["inheritPreviewColors"];
  onSelect: (id: string) => void;
};

/** 内联配色列表：不走 Portal，专供 216px 图表栏 */
export function ChartPaletteInlineMenu({
  rows,
  selectedId,
  inheritValue,
  inheritPreviewColors,
  onSelect,
}: ChartPaletteInlineMenuProps) {
  return (
    <div
      role="listbox"
      aria-label="配色方案"
      data-testid="chart-palette-inline-menu"
      className="flex flex-col gap-0.5"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {rows.map((row) => {
        const selected = row.id === selectedId;
        return (
          <button
            key={row.id}
            type="button"
            role="option"
            aria-selected={selected}
            className={cn(
              "flex w-full cursor-pointer rounded-lg px-2 py-2 text-left transition-colors touch-manipulation",
              "hover:bg-gray-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30",
              "dark:hover:bg-white/5",
              selected && "bg-brand-50 dark:bg-brand-500/10",
            )}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(row.id);
            }}
          >
            <PaletteMenuOption
              row={row}
              inherit={row.id === inheritValue}
              inheritPreviewColors={inheritPreviewColors}
              selected={selected}
            />
          </button>
        );
      })}
    </div>
  );
}

type ChartPaletteCurrentDisplayProps = {
  activeLabel: string;
  activeColors: readonly string[];
  inheritActive: boolean;
  inheritPreviewColors?: ChartPaletteSwatchStripProps["inheritPreviewColors"];
  triggerClass: string;
  /** 窄栏：作为展开触发器（点击展开列表，选中后收起） */
  menuOpen?: boolean;
  onMenuToggle?: () => void;
};

/** 当前选中展示；窄栏可点击展开配色列表 */
export function ChartPaletteCurrentDisplay({
  activeLabel,
  activeColors,
  inheritActive,
  inheritPreviewColors,
  triggerClass,
  menuOpen = false,
  onMenuToggle,
}: ChartPaletteCurrentDisplayProps) {
  const content = (
    <>
      <span className="flex min-w-0 w-full flex-1 flex-col items-start gap-1 overflow-hidden text-left">
        <ChartPaletteSwatchStrip
          colors={activeColors}
          inherit={inheritActive}
          inheritPreviewColors={inheritPreviewColors}
          className="w-full rounded-[2px]"
        />
        <span className="min-w-0 w-full truncate text-left text-theme-xs font-medium leading-tight text-gray-800 dark:text-gray-200">
          {activeLabel}
        </span>
      </span>
      {onMenuToggle ? (
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 self-center text-gray-400 transition-transform dark:text-gray-500",
            menuOpen && "rotate-180",
          )}
          aria-hidden
        />
      ) : null}
    </>
  );

  if (onMenuToggle) {
    return (
      <button
        type="button"
        aria-label="配色方案"
        aria-expanded={menuOpen}
        aria-haspopup="listbox"
        className={cn(
          triggerClass,
          "flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 text-left",
          "h-auto min-h-8 py-1",
        )}
        onClick={(event) => {
          event.stopPropagation();
          onMenuToggle();
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      aria-label="当前配色方案"
      className={cn(
        triggerClass,
        "pointer-events-none flex min-w-0 flex-1 items-center justify-between gap-2 text-left",
        "h-auto min-h-8 py-1",
      )}
    >
      {content}
    </div>
  );
}
