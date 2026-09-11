import type { ReactNode } from "react";
import { Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TruncateHint } from "@/components/ui/hint-tooltip";
import {
  formatSyncDatasourceStructured,
  type DatasourceDisplayFields,
} from "@/lib/formatDatasourceDisplay";
import { cn } from "@/lib/utils";

const READOUT_SHELL_CLASS =
  "rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-white/[0.02]";

/** 与 SelectTrigger 一致的表单控件外框（Dataset 顶栏紧凑态） */
const FIELD_MATCH_SHELL_CLASS =
  "rounded-lg border border-gray-300 bg-transparent shadow-theme-xs dark:border-gray-700 dark:bg-gray-900";

/** 同步产物页顶栏：左右读数卡等高 */
export const SYNC_HEADER_READOUT_MIN_H = "min-h-[5.5rem]";

export const SYNC_HEADER_LABEL_BLOCK_CLASS = "grid min-h-10 content-start gap-0.5";

export function SyncOutputConnectionReadout({
  datasource,
  className,
  id,
  tall = false,
  "data-testid": dataTestId,
}: {
  datasource: DatasourceDisplayFields;
  className?: string;
  id?: string;
  tall?: boolean;
  "data-testid"?: string;
}) {
  const info = formatSyncDatasourceStructured(datasource);

  return (
    <div
      id={id}
      data-testid={dataTestId}
      className={cn(
        READOUT_SHELL_CLASS,
        "grid content-center gap-1.5",
        tall && cn(SYNC_HEADER_READOUT_MIN_H, "h-full"),
        className,
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <TruncateHint
          title={info.name}
          className="min-w-0 flex-1 text-theme-sm font-medium leading-snug text-gray-800 dark:text-gray-200"
        >
          {info.name}
        </TruncateHint>
        {info.type ? (
          <Badge variant="light" color="light" size="sm" className="shrink-0 font-mono uppercase">
            {info.type}
          </Badge>
        ) : null}
      </div>
      {info.connectionLine ? (
        <TruncateHint
          title={info.connectionLine}
          className="block min-w-0 font-mono text-theme-xs leading-relaxed text-gray-600 dark:text-gray-300"
        >
          {info.connectionLine}
        </TruncateHint>
      ) : null}
      {info.code ? (
        <p className="min-w-0 truncate text-theme-xs leading-relaxed text-gray-500 dark:text-gray-400">
          <span className="text-gray-400 dark:text-gray-500">code</span>{" "}
          <span className="font-mono text-gray-600 dark:text-gray-300">{info.code}</span>
        </p>
      ) : null}
    </div>
  );
}

export function DatasetQualifiedTableReadout({
  tableName,
  className,
  tall = false,
  action,
}: {
  tableName: string;
  className?: string;
  /** 与 SyncOutputConnectionReadout 顶栏等高（同步产物只读场景） */
  tall?: boolean;
  /** 右侧操作（如「更换」），与表名同处一张读数卡内 */
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        tall ? READOUT_SHELL_CLASS : FIELD_MATCH_SHELL_CLASS,
        "flex min-w-0 items-center gap-2",
        tall ? cn(SYNC_HEADER_READOUT_MIN_H, "h-full") : "h-11 px-3 py-0",
        className,
      )}
    >
      <Database className="size-4 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden />
      <TruncateHint
        title={tableName}
        className="min-w-0 flex-1 font-mono text-sm leading-snug text-gray-800 dark:text-white/90"
      >
        {tableName}
      </TruncateHint>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
