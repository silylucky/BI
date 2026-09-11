import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Eye } from "lucide-react";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import {
  DataTable,
  ListPageBody,
  ListPagePagination,
  ListPageSection,
  ListPageTableFrame,
  ListPageToolbar,
  PageErrorBanner,
  RowActions,
} from "@/components/layout/list-page-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/button";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { DateField } from "@/components/ui/date-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { useListPagination } from "@/lib/list-pagination";
import { AuditDetailSheet } from "./AuditDetailSheet";
import {
  AUDIT_ACTION_OPTIONS,
  AUDIT_PRESET_FILTERS,
  AUDIT_TARGET_TYPE_OPTIONS,
  auditActionLabel,
  auditTargetTypeLabel,
  formatAuditSummary,
  formatAuditTimestamp,
  shortId,
  type AuditEventRow,
} from "./audit-display";

export function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [targetType, setTargetType] = useState<string>("all");
  const [createdAfter, setCreatedAfter] = useState("");
  const [createdBefore, setCreatedBefore] = useState("");
  const [debounced, setDebounced] = useState({
    action: "",
    targetType: "",
    createdAfter: "",
    createdBefore: "",
  });
  const [selected, setSelected] = useState<AuditEventRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(
      () =>
        setDebounced({
          action: actionFilter === "all" ? "" : actionFilter,
          targetType: targetType === "all" ? "" : targetType,
          createdAfter: createdAfter.trim(),
          createdBefore: createdBefore.trim(),
        }),
      300,
    );
    return () => window.clearTimeout(t);
  }, [actionFilter, targetType, createdAfter, createdBefore]);

  const pagination = useListPagination(20, [
    debounced.action,
    debounced.targetType,
    debounced.createdAfter,
    debounced.createdBefore,
  ]);

  const params = useMemo(() => {
    const p: Record<string, string> = {
      limit: String(pagination.pageSize),
      offset: String(pagination.offset),
    };
    if (debounced.action) p.action = debounced.action;
    if (debounced.targetType) p.target_type = debounced.targetType;
    if (debounced.createdAfter) {
      p.created_after = new Date(`${debounced.createdAfter}T00:00:00`).toISOString();
    }
    if (debounced.createdBefore) {
      p.created_before = new Date(`${debounced.createdBefore}T23:59:59.999`).toISOString();
    }
    return p;
  }, [debounced, pagination.pageSize, pagination.offset]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.audit.events(params),
    queryFn: () => {
      const q = new URLSearchParams(params);
      return apiFetch<{ items: AuditEventRow[]; total: number }>(`/api/v1/audit/events?${q}`);
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const openDetail = (event: AuditEventRow) => {
    setSelected(event);
    setDetailOpen(true);
  };

  return (
    <AdminPageShell
      layout="list"
      title="审计日志"
      description="记录平台内的账号、角色、组织等敏感操作，便于安全审计与问题追溯。"
    >
      <ListPageSection>
        {isError ? (
          <ListPageBody className="border-b py-3">
            <PageErrorBanner message={mapApiError(error)} onRetry={() => void refetch()} />
          </ListPageBody>
        ) : null}

        <ListPageToolbar
          filters={
            <>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="h-11 w-full sm:w-[180px]" aria-label="筛选操作类型">
                  <SelectValue placeholder="操作类型" />
                </SelectTrigger>
                <SelectContent>
                  {AUDIT_ACTION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={targetType} onValueChange={setTargetType}>
                <SelectTrigger className="h-11 w-full sm:w-[160px]" aria-label="筛选目标类型">
                  <SelectValue placeholder="目标类型" />
                </SelectTrigger>
                <SelectContent>
                  {AUDIT_TARGET_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DateField
                className="w-full sm:w-[168px]"
                value={createdAfter || undefined}
                onChange={(value) => setCreatedAfter(value ?? "")}
                placeholder="起始日期"
                aria-label="筛选起始日期"
              />
              <DateField
                className="w-full sm:w-[168px]"
                value={createdBefore || undefined}
                onChange={(value) => setCreatedBefore(value ?? "")}
                placeholder="结束日期"
                aria-label="筛选结束日期"
              />
              <div className="flex flex-wrap gap-2">
                {AUDIT_PRESET_FILTERS.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActionFilter(preset.action);
                      setTargetType(preset.targetType);
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </>
          }
          actions={
            !isLoading && data ? (
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                {debounced.action ||
                debounced.targetType ||
                debounced.createdAfter ||
                debounced.createdBefore
                  ? `筛选结果 ${total} 条`
                  : `共 ${total} 条`}
              </p>
            ) : null
          }
        />

        <ListPageTableFrame className="px-0">
          <DataTable
            loading={isLoading}
            empty={!isLoading && items.length === 0}
            headers={["时间", "操作", "操作者", "目标", "摘要", ""]}
            lastColumnAlign="right"
            loadingRows={6}
            emptyState={{
              icon: <ClipboardList className="size-7" aria-hidden />,
              title: "暂无审计记录",
              description: "调整筛选条件，或等待平台产生新的操作事件。",
            }}
            rows={items.map((row) => {
              const stamp = formatAuditTimestamp(row.created_at);
              return [
                <div key={`${row.id}-time`} className="min-w-[108px]">
                  <p className="text-theme-sm text-gray-800 dark:text-white/90">{stamp.date}</p>
                  <p className="font-mono text-theme-xs text-gray-500 dark:text-gray-400">{stamp.time}</p>
                </div>,
                <div key={`${row.id}-action`} className="min-w-[180px]">
                  <Badge variant="light" color="primary" size="sm">
                    {auditActionLabel(row.action)}
                  </Badge>
                  <p className="mt-1 font-mono text-theme-xs text-gray-500 dark:text-gray-400">
                    {row.action}
                  </p>
                </div>,
                <span key={`${row.id}-actor`} className="font-medium text-gray-800 dark:text-white/90">
                  {row.actor_username ?? shortId(row.actor_id)}
                </span>,
                <div key={`${row.id}-target`} className="min-w-[140px]">
                  <Badge variant="light" color="light" size="sm">
                    {auditTargetTypeLabel(row.target_type)}
                  </Badge>
                  <p className="mt-1 font-mono text-theme-xs text-gray-500 dark:text-gray-400">
                    {shortId(row.target_id)}
                  </p>
                </div>,
                <HintTooltip label={formatAuditSummary(row)}>
                  <p
                    key={`${row.id}-summary`}
                    className="max-w-md truncate text-theme-sm leading-relaxed text-gray-600 dark:text-gray-400"
                  >
                    {formatAuditSummary(row)}
                  </p>
                </HintTooltip>,
                <RowActions key={`${row.id}-actions`}>
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="查看详情"
                    onClick={() => openDetail(row)}
                  >
                    <Eye className="size-4" />
                  </IconButton>
                </RowActions>,
              ];
            })}
          />
        </ListPageTableFrame>

        {!isLoading && total > 0 ? (
          <ListPagePagination
            current={pagination.page}
            pageSize={pagination.pageSize}
            total={total}
            showSizeChanger
            onChange={pagination.onPageChange}
          />
        ) : null}
      </ListPageSection>

      <AuditDetailSheet event={selected} open={detailOpen} onOpenChange={setDetailOpen} />
    </AdminPageShell>
  );
}
