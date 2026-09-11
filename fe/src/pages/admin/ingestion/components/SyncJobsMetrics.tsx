import {
  CalendarClock,
  CirclePause,
  ListChecks,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SyncJobStats = {
  total: number;
  enabled: number;
  disabled: number;
  scheduled: number;
};

const METRICS: {
  key: keyof SyncJobStats;
  label: string;
  icon: LucideIcon;
  iconClassName: string;
}[] = [
  {
    key: "total",
    label: "任务总数",
    icon: ListChecks,
    iconClassName:
      "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
  },
  {
    key: "enabled",
    label: "已启用",
    icon: RefreshCw,
    iconClassName:
      "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400",
  },
  {
    key: "disabled",
    label: "已停用",
    icon: CirclePause,
    iconClassName: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400",
  },
  {
    key: "scheduled",
    label: "定时任务",
    icon: CalendarClock,
    iconClassName:
      "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400",
  },
];

export function SyncJobsMetrics({ stats }: { stats: SyncJobStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {METRICS.map(({ key, label, icon: Icon, iconClassName }) => (
        <Card key={key} elevation={1}>
          <CardContent className="flex items-center gap-4 p-5">
            <div
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl",
                iconClassName,
              )}
            >
              <Icon className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">{label}</p>
              <p className="mt-0.5 text-title-sm font-semibold text-gray-900 dark:text-white">
                {stats[key]}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
