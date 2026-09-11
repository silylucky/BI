import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiFetch } from "@/lib/api";

type ExportHealth = {
  status: "available" | "unavailable";
  error?: string | null;
};

export const SCHEDULE_EXPORT_HEALTH_KEY = ["reports", "schedules", "export-health"] as const;
export const SCHEDULE_DELIVERY_HEALTH_KEY = ["reports", "schedules", "delivery-health"] as const;

function fetchExportHealth(forceRefresh = false): Promise<ExportHealth> {
  const qs = forceRefresh ? "?forceRefresh=1" : "";
  return apiFetch<ExportHealth>(`/api/v1/reports/schedules/export-health${qs}`);
}

export function ScheduleExportHealthAlert({ className }: { className?: string }) {
  const healthQuery = useScheduleExportHealth();

  const health = healthQuery.data;
  if (!health || health.status === "available") return null;

  return (
    <Alert variant="warning" className={className}>
      <AlertTriangle className="size-4" aria-hidden />
      <AlertTitle>PDF 导出服务不可用</AlertTitle>
      <AlertDescription>
        {health.error ??
          "PDF 导出服务不可用，看板定时报告无法生成可视化 PDF。请联系管理员检查导出服务。"}
        调度仍可创建，但激活后执行将失败。
      </AlertDescription>
    </Alert>
  );
}

export function useScheduleExportHealth(options?: { forceRefresh?: boolean; enabled?: boolean }) {
  const forceRefresh = options?.forceRefresh ?? false;
  return useQuery({
    queryKey: [...SCHEDULE_EXPORT_HEALTH_KEY, forceRefresh ? "force" : "default"],
    queryFn: () => fetchExportHealth(forceRefresh),
    staleTime: forceRefresh ? 0 : 30_000,
    enabled: options?.enabled ?? true,
  });
}
