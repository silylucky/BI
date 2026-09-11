import { useMemo, useState } from "react";
import { GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { writeFieldDragData } from "@/lib/chartFieldDrag";
import { useChartInspector } from "./ChartInspectorContext";

type DatasetFieldBankProps = {
  className?: string;
};

export function DatasetFieldBank({ className }: DatasetFieldBankProps) {
  const { columns, columnsLoading, columnsReady, assignField, activeSlot } = useChartInspector();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return columns;
    return columns.filter((c) => c.toLowerCase().includes(q));
  }, [columns, search]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-gray-50/50 dark:bg-white/[0.02]", className)}>
      <div className="shrink-0 border-b border-gray-200 px-3 py-2.5 dark:border-gray-800">
        <h3 className="text-theme-xs font-semibold text-gray-700 dark:text-gray-300">字段</h3>
        <p className="mt-0.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
          拖入左侧槽位{activeSlot ? "，或点击填入当前槽位" : ""}
        </p>
        <Input
          type="search"
          placeholder="搜索…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-2 h-9 text-theme-xs"
          aria-label="搜索字段"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {columnsReady && columnsLoading ? (
          <p className="px-2 py-3 text-theme-xs text-gray-500">加载中…</p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-3 text-theme-xs text-gray-500 dark:text-gray-400">
            {columns.length === 0 ? "绑定 Dataset 后显示字段" : "无匹配字段"}
          </p>
        ) : (
          <ul className="space-y-0.5" aria-label="数据集字段">
            {filtered.map((field) => (
              <li key={field}>
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    writeFieldDragData(e.dataTransfer, field);
                  }}
                  onClick={() => assignField(field)}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-left text-theme-xs hover:bg-white dark:hover:bg-white/[0.06]"
                >
                  <GripVertical
                    className="size-3.5 shrink-0 text-gray-400"
                    aria-hidden
                  />
                  <span className="min-w-0 truncate font-medium text-gray-800 dark:text-white/90">
                    {field}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function FieldBankPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col items-center justify-center bg-gray-50/50 px-3 text-center dark:bg-white/[0.02]",
        className,
      )}
    >
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">选中图表后显示字段库</p>
    </div>
  );
}
