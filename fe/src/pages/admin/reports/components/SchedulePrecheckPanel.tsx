import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { emailSmtpSlotLabel } from "@/lib/emailSmtpSlots";
import { cn } from "@/lib/utils";
import {
  SCHEDULE_DELIVERY_HEALTH_KEY,
  SCHEDULE_EXPORT_HEALTH_KEY,
  useScheduleExportHealth,
} from "./ScheduleExportHealthAlert";

type DeliveryHealth = {
  status: "reachable" | "unreachable" | "unconfigured";
  error?: string | null;
};

type PrecheckItem = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  fixHint?: string;
  blocking?: boolean;
};

type SchedulePrecheckPanelProps = {
  sourceLabel: string;
  widgetCount?: number;
  requireVisualExport?: boolean;
  className?: string;
  /** 弹窗打开时触发一次强制刷新 */
  active?: boolean;
  emailSmtpSlot?: "qq" | "163";
};

function precheckFixHint(item: PrecheckItem): string | undefined {
  if (item.ok) return undefined;
  const detail = item.detail.toLowerCase();
  if (item.id === "delivery") {
    if (detail.includes("1025") || detail.includes("mailhog") || detail.includes("localhost")) {
      return "请在系统管理 → 平台对接配置邮件 SMTP；本地调试可 docker compose up -d mailhog";
    }
    return "请在系统管理 → 平台对接配置邮件 SMTP（保存前会自动探测连通性）";
  }
  if (item.id === "export") {
    if (detail.includes("playwright") || detail.includes("chromium")) {
      return "本地修复：cd backend && pip install -e \".[dev]\" && python -m playwright install chromium";
    }
    if (detail.includes("5173") || detail.includes("前端")) {
      return "请确认 fe 已启动（pnpm dev），且 FE_BASE_URL 与访问地址一致";
    }
  }
  return undefined;
}

function PrecheckRow({ item }: { item: PrecheckItem }) {
  const fixHint = item.fixHint ?? precheckFixHint(item);
  return (
    <li className="flex items-start gap-2 text-theme-xs">
      {item.ok ? (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success-600 dark:text-success-400" aria-hidden />
      ) : (
        <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      )}
      <span className="min-w-0">
        <span className="font-medium text-gray-800 dark:text-white/90">{item.label}</span>
        <span className="mt-0.5 block text-gray-500 dark:text-gray-400">{item.detail}</span>
        {fixHint ? (
          <span className="mt-1 block text-gray-600 dark:text-gray-300">{fixHint}</span>
        ) : null}
      </span>
    </li>
  );
}

export function useSchedulePrecheckItems(input: {
  sourceLabel: string;
  widgetCount?: number;
  requireVisualExport?: boolean;
  forceRefresh?: boolean;
  emailSmtpSlot?: "qq" | "163";
}): {
  items: PrecheckItem[];
  blocking: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const deliveryQuery = useQuery({
    queryKey: [...SCHEDULE_DELIVERY_HEALTH_KEY, input.emailSmtpSlot ?? "qq"],
    queryFn: () =>
      apiFetch<DeliveryHealth>(
        `/api/v1/reports/schedules/delivery-health?emailSmtpSlot=${input.emailSmtpSlot ?? "qq"}`,
      ),
    staleTime: 30_000,
  });
  const exportQuery = useScheduleExportHealth({ forceRefresh: input.forceRefresh });
  const queryClient = useQueryClient();
  const loading = deliveryQuery.isLoading || exportQuery.isLoading;

  const refetch = useCallback(async () => {
    await Promise.all([
      queryClient.fetchQuery({
        queryKey: [...SCHEDULE_DELIVERY_HEALTH_KEY, input.emailSmtpSlot ?? "qq"],
        queryFn: () =>
          apiFetch<DeliveryHealth>(
            `/api/v1/reports/schedules/delivery-health?emailSmtpSlot=${input.emailSmtpSlot ?? "qq"}`,
          ),
        staleTime: 0,
      }),
      queryClient.fetchQuery({
        queryKey: [...SCHEDULE_EXPORT_HEALTH_KEY, "force"],
        queryFn: () =>
          apiFetch<{ status: string; error?: string | null }>(
            "/api/v1/reports/schedules/export-health?forceRefresh=1",
          ),
        staleTime: 0,
      }),
    ]);
    await queryClient.invalidateQueries({ queryKey: SCHEDULE_EXPORT_HEALTH_KEY });
  }, [queryClient]);

  const items: PrecheckItem[] = [];
  const widgetOk = input.widgetCount === undefined || input.widgetCount > 0;
  items.push({
    id: "page",
    label: "目标页面",
    ok: widgetOk,
    detail: widgetOk
      ? `「${input.sourceLabel}」已包含 ${input.widgetCount ?? "若干"} 个可视化组件，可导出 PDF。`
      : `「${input.sourceLabel}」暂无组件，请先在编辑器中添加图表后再创建定时报告。`,
    blocking: !widgetOk,
  });

  const delivery = deliveryQuery.data;
  const deliveryOk = delivery?.status === "reachable";
  items.push({
    id: "delivery",
    label: "邮件投递",
    ok: deliveryOk,
    detail:
      delivery?.error ??
      (deliveryOk
        ? `${emailSmtpSlotLabel(input.emailSmtpSlot ?? "qq")} 发信通道可用，激活后可正常投递。`
        : `${emailSmtpSlotLabel(input.emailSmtpSlot ?? "qq")} 发信通道未配置或不可达；激活后执行可能投递失败，请联系管理员。`),
    blocking: false,
  });

  if (input.requireVisualExport !== false) {
    const exportHealth = exportQuery.data;
    const exportOk = exportHealth?.status === "available";
    items.push({
      id: "export",
      label: "PDF 导出服务",
      ok: exportOk,
      detail:
        exportHealth?.error ??
        (exportOk
          ? "PDF 导出服务就绪，将生成可视化快照。"
          : "PDF 导出服务不可用，无法生成可视化 PDF，请联系管理员。"),
      blocking: !exportOk,
    });
  }

  const blocking = items.some((item) => item.blocking && !item.ok);
  return { items, blocking, loading, refetch };
}

export function SchedulePrecheckPanel({
  sourceLabel,
  widgetCount,
  requireVisualExport = true,
  className,
  active = true,
  emailSmtpSlot = "qq",
}: SchedulePrecheckPanelProps) {
  const [manualRefresh, setManualRefresh] = useState(false);
  const { items, loading, refetch } = useSchedulePrecheckItems({
    sourceLabel,
    widgetCount,
    requireVisualExport,
    forceRefresh: manualRefresh,
    emailSmtpSlot,
  });

  useEffect(() => {
    if (!active) return;
    void refetch();
  }, [active, refetch]);

  const handleRefresh = async () => {
    setManualRefresh(true);
    await refetch();
    setManualRefresh(false);
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-white/[0.02]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">创建前检查</p>
          <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
            定时报告复用当前看板已保存的查询与筛选，无需在此重复配置数据集。
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          disabled={loading}
          onClick={() => void handleRefresh()}
        >
          <RefreshCw className={cn("size-3.5", loading ? "animate-spin" : "")} aria-hidden />
          重新检查
        </Button>
      </div>
      {loading ? (
        <p className="mt-3 text-theme-xs text-gray-400">检查中…</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <PrecheckRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function canCreateDashboardSchedule(input: {
  widgetCount?: number;
  exportStatus?: string;
  loading?: boolean;
}): boolean {
  if (input.loading) return false;
  if (input.widgetCount !== undefined && input.widgetCount <= 0) return false;
  if (input.exportStatus && input.exportStatus !== "available") return false;
  return true;
}
