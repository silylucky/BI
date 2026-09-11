import { Link } from "react-router";
import { Pin, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { standardAnalysisPath } from "../standardRoutes";
import { cn } from "@/lib/utils";

type AnalysisPack = {
  packKey: string;
  displayName: string;
  enabledThemes: string[];
};

type Props = {
  items: AnalysisPack[];
  pinnedKeys: string[];
  onTogglePin: (key: string) => void;
};

export function ReportCenterStandardPanel({ items, pinnedKeys, onTogglePin }: Props) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((pack) => {
        const pinned = pinnedKeys.includes(pack.packKey);
        return (
          <li
            key={pack.packKey}
            className="group flex flex-col rounded-xl border border-gray-200 bg-gray-50/50 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/20 dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-brand-500/30 dark:hover:bg-brand-500/5"
          >
            <div className="flex items-start gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-8 shrink-0 p-0"
                aria-label={pinned ? `取消固定 ${pack.displayName}` : `固定 ${pack.displayName}`}
                aria-pressed={pinned}
                onClick={() => onTogglePin(pack.packKey)}
              >
                <Pin
                  className={cn("size-4", pinned ? "fill-current text-brand-500" : "text-gray-400")}
                  aria-hidden
                />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-theme-sm font-semibold text-gray-800 dark:text-white/90">
                  {pack.displayName}
                </p>
                <p className="mt-0.5 truncate text-theme-xs text-gray-500 dark:text-gray-400">
                  {pack.enabledThemes.length} 个分析主题
                </p>
              </div>
            </div>
            <div className="mt-3">
              <Button type="button" variant="outline" size="sm" className="h-8 w-full sm:w-auto" asChild>
                <Link to={standardAnalysisPath(pack.packKey)} aria-label={`打开 ${pack.displayName}`}>
                  <TrendingUp className="size-3.5" aria-hidden />
                  打开分析
                </Link>
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
