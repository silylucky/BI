import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Filter, GripVertical, Plus } from "lucide-react";
import type { ChartType } from "@/lib/chartViewConfig";
import { setChartTypeDragData, setFilterWidgetDragData } from "@/lib/dashboardDnd";
import { fetchChartTypeCatalog, buildFallbackCatalogItems, type ChartTypeCatalogItem } from "@/lib/chartRegistry";
import {
  groupCatalogItemsByCategory,
} from "@/lib/chartTypeCatalogDisplay";
import { cn } from "@/lib/utils";
import {
  ChartExploreCatalogTrigger,
  ChartExploreDrawer,
} from "@/components/dashboard/ChartExploreDrawer";
import type { PaletteInsertType } from "./createLayoutWidget";
import { widgetChartIcon } from "./widgetIcons";

type WidgetPaletteProps = {
  onInsert: (type: PaletteInsertType) => void;
  /** 嵌入 DashboardEditWorkspace 时省略外层卡片 */
  embedded?: boolean;
};

function PaletteRow({
  item,
  onInsert,
}: {
  item: ChartTypeCatalogItem;
  onInsert: (type: ChartType) => void;
}) {
  const Icon = widgetChartIcon(item.type);
  const chartType = item.type as ChartType;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => setChartTypeDragData(e.dataTransfer, chartType)}
      onClick={() => onInsert(chartType)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onInsert(chartType);
        }
      }}
      className={cn(
        "group flex w-full cursor-grab items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-left transition-colors active:cursor-grabbing",
        "hover:border-brand-200 hover:bg-brand-50/60 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/10",
        "focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20",
      )}
    >
      <GripVertical
        className="size-3.5 shrink-0 text-gray-300 group-hover:text-gray-400 dark:text-gray-600"
        aria-hidden
      />
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-white dark:bg-white/5 dark:text-gray-400 dark:group-hover:bg-white/10">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-theme-sm font-medium text-gray-700 dark:text-gray-300">
        {item.displayName}
      </span>
      <Plus
        className="size-4 shrink-0 text-brand-500 opacity-0 transition-opacity group-hover:opacity-100 dark:text-brand-400"
        aria-hidden
      />
    </div>
  );
}

function FilterPaletteRow({ onInsert }: { onInsert: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => setFilterWidgetDragData(e.dataTransfer)}
      onClick={onInsert}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onInsert();
        }
      }}
      className={cn(
        "group flex w-full cursor-grab items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-left transition-colors active:cursor-grabbing",
        "hover:border-brand-200 hover:bg-brand-50/60 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/10",
        "focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20",
      )}
    >
      <GripVertical
        className="size-3.5 shrink-0 text-gray-300 group-hover:text-gray-400 dark:text-gray-600"
        aria-hidden
      />
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-white dark:bg-white/5 dark:text-gray-400 dark:group-hover:bg-white/10">
        <Filter className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-theme-sm font-medium text-gray-700 dark:text-gray-300">
        筛选器
      </span>
      <Plus
        className="size-4 shrink-0 text-brand-500 opacity-0 transition-opacity group-hover:opacity-100 dark:text-brand-400"
        aria-hidden
      />
    </div>
  );
}

function PaletteGroup({
  title,
  items,
  onInsert,
}: {
  title: string;
  items: ChartTypeCatalogItem[];
  onInsert: (type: ChartType) => void;
}) {
  if (!items.length) return null;

  return (
    <div className="space-y-1">
      <p className="px-2 pb-1 text-theme-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {title}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <PaletteRow key={item.type} item={item} onInsert={onInsert} />
        ))}
      </div>
    </div>
  );
}

function CatalogFooter({ onOpenCatalog }: { onOpenCatalog: () => void }) {
  return (
    <div className="border-t border-gray-200 pt-3 dark:border-gray-800">
      <ChartExploreCatalogTrigger onOpen={onOpenCatalog} />
    </div>
  );
}

export function WidgetPalette({ onInsert, embedded = false }: WidgetPaletteProps) {
  const [catalog, setCatalog] = useState<ChartTypeCatalogItem[] | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);

  useEffect(() => {
    void fetchChartTypeCatalog()
      .then((items) => setCatalog(Array.isArray(items) ? items : null))
      .catch(() => {
        setCatalog(null);
        toast.message("图表目录加载失败，已使用本地内置列表");
      });
  }, []);

  const groups = useMemo(() => {
    const items = catalog?.length ? catalog : buildFallbackCatalogItems();
    return groupCatalogItemsByCategory(items);
  }, [catalog]);

  const content = (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="px-2 pb-1 text-theme-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          筛选
        </p>
        <FilterPaletteRow onInsert={() => onInsert("filter")} />
      </div>
      {groups.map((group) => (
        <PaletteGroup
          key={group.category}
          title={group.label}
          items={group.items}
          onInsert={onInsert}
        />
      ))}
      <CatalogFooter onOpenCatalog={() => setCatalogOpen(true)} />
    </div>
  );

  const paletteBody = (
    <>
      {content}
      <ChartExploreDrawer open={catalogOpen} onOpenChange={setCatalogOpen} />
    </>
  );

  if (embedded) {
    return paletteBody;
  }

  return (
    <aside className="w-full shrink-0">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
        <h2 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">组件</h2>
        <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
          拖拽到画布，或点击追加到末尾
        </p>
        <div className="mt-4">{paletteBody}</div>
      </div>
    </aside>
  );
}
