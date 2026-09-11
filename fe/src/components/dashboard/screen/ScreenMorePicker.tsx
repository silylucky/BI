import type { ReactNode } from "react";
import { CalendarClock, Globe } from "lucide-react";
import { setScreenInsertDragData } from "@/lib/dashboardDnd";
import { cn } from "@/lib/utils";
import type { PaletteInsertType } from "@/components/dashboard/createLayoutWidget";
import { SCREEN_MORE_CATALOG, type ScreenMoreCatalogItem } from "@/lib/screenMoreCatalog";

type ScreenMorePickerProps = {
  onInsert: (type: PaletteInsertType) => void;
  onInserted?: () => void;
  extraActions?: ReactNode;
  onPaletteDragStart?: () => void;
  onPaletteDragEnd?: () => void;
};

const MORE_ICONS: Record<string, ReactNode> = {
  datetime: <CalendarClock className="size-8 text-cyan-300/90" aria-hidden />,
  webpage: <Globe className="size-8 text-sky-300/90" aria-hidden />,
};

function MoreTile({
  item,
  onInsert,
  onInserted,
  onPaletteDragStart,
  onPaletteDragEnd,
}: {
  item: ScreenMoreCatalogItem;
  onInsert: (type: PaletteInsertType) => void;
  onInserted?: () => void;
  onPaletteDragStart?: () => void;
  onPaletteDragEnd?: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(event) => {
        setScreenInsertDragData(event.dataTransfer, item.insertType);
        onPaletteDragStart?.();
        event.stopPropagation();
      }}
      onDragEnd={() => {
        onPaletteDragEnd?.();
      }}
      onClick={() => {
        onInsert(item.insertType);
        onInserted?.();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onInsert(item.insertType);
          onInserted?.();
        }
      }}
      className={cn(
        "flex cursor-grab flex-col items-center gap-1.5 rounded-lg border border-transparent p-2 text-center transition-colors active:cursor-grabbing",
        "hover:border-brand-200 hover:bg-brand-50/60 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/10",
        "focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20",
      )}
      data-testid={`screen-more-${item.id}`}
    >
      <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-slate-900/90 dark:bg-white/[0.06]">
        {MORE_ICONS[item.id]}
      </span>
      <span className="line-clamp-2 w-full text-[11px] leading-tight text-gray-700 dark:text-gray-300">
        {item.label}
      </span>
    </div>
  );
}

export function ScreenMorePicker({
  onInsert,
  onInserted,
  extraActions,
  onPaletteDragStart,
  onPaletteDragEnd,
}: ScreenMorePickerProps) {
  return (
    <div className="p-3" data-testid="screen-more-picker">
      <p className="mb-2 px-1 text-[11px] text-gray-500 dark:text-gray-400">
        拖拽或点击插入素材组件
      </p>
      <div className="grid grid-cols-2 gap-2">
        {SCREEN_MORE_CATALOG.map((item) => (
          <MoreTile
            key={item.id}
            item={item}
            onInsert={onInsert}
            onInserted={onInserted}
            onPaletteDragStart={onPaletteDragStart}
            onPaletteDragEnd={onPaletteDragEnd}
          />
        ))}
      </div>
      {extraActions ? (
        <div className="mt-3 border-t border-gray-100 pt-3 dark:border-white/[0.06]">
          {extraActions}
        </div>
      ) : null}
    </div>
  );
}
