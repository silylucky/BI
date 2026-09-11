import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Database, Eye, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  BatchDeleteDialog,
  ListPageBatchActions,
  ListHeaderCheckbox,
  ListRowCheckbox,
  useListBatchMode,
  DESTRUCTIVE_ALERT_ACTION_CLASS,
} from "@/components/layout/list-batch-delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminPageShell, AdminPageHeaderIcon } from "@/components/layout/admin-page-shell";
import {
  DataTable,
  DeleteRowIconButton,
  ListPageBody,
  ListPagePagination,
  ListPageSection,
  ListPageTableFrame,
  ListPageToolbar,
  PageErrorBanner,
  RowActions,
} from "@/components/layout/list-page-kit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, IconButton } from "@/components/ui/button";
import { TruncateHint } from "@/components/ui/hint-tooltip";
import { Label } from "@/components/ui/label";
import { SearchField } from "@/components/ui/search-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import {
  connectorTypeIcon,
  normalizeConnectorTypes,
  type ConnectorTypeItem,
  type DisplayGroup,
  type RawConnectorTypeItem,
} from "@/lib/connector-taxonomy";
import { queryKeys } from "@/lib/queryKeys";
import { useListPagination } from "@/lib/list-pagination";
import { useListRowSelection } from "@/hooks/useListRowSelection";
import { runBatchDelete } from "@/lib/runBatchDelete";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { isProtectedDemoDatasource } from "@/lib/demoPackage";
import { isAnalyticsDatasource, isManagedAnalyticsDatasource, isSyncSourceCapable } from "@/lib/datasourceRoles";

type DataSourceOut = {
  id: string;
  name: string;
  code: string;
  type: string;
  host: string;
  port: number;
  database: string;
  description?: string | null;
  isDemoPackage?: boolean;
};

type DataSourceListResponse = {
  items: DataSourceOut[];
  total: number;
};

type ConnectorTypeListResponse = {
  items: RawConnectorTypeItem[];
};

const ALL_TYPES = "all";

function formatConnectionEndpoint(row: DataSourceOut): { primary: string; secondary?: string } {
  const endpoint =
    row.port && row.port !== 1 ? `${row.host}:${row.port}` : row.host || "—";
  const secondary = row.database?.trim() || undefined;
  return { primary: endpoint, secondary };
}

function DatasourceTypeCell({
  type,
  meta,
}: {
  type: string;
  meta?: ConnectorTypeItem;
}) {
  const group: DisplayGroup = meta?.displayGroup ?? "extension";
  const Icon = connectorTypeIcon(type, group);
  const label = meta?.displayName ?? type;

  return (
    <div className="flex min-w-[140px] items-center gap-2.5">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400"
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium text-gray-800 dark:text-white/90">{label}</p>
        {meta?.categoryLabel ? (
          <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
            {meta.categoryLabel}
          </p>
        ) : (
          <p className="font-mono text-theme-xs text-gray-500 dark:text-gray-400">{type}</p>
        )}
      </div>
    </div>
  );
}

export function DatasourceListPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);
  const [deleteTarget, setDeleteTarget] = useState<DataSourceOut | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const pagination = useListPagination(20, [debouncedQ, typeFilter]);

  const listParams = useMemo(
    () => ({
      q: debouncedQ || undefined,
      type: typeFilter === ALL_TYPES ? undefined : typeFilter,
      limit: pagination.pageSize,
      offset: pagination.offset,
    }),
    [debouncedQ, typeFilter, pagination.pageSize, pagination.offset],
  );

  const typesQuery = useQuery({
    queryKey: queryKeys.connectorTypes,
    queryFn: () => apiFetch<ConnectorTypeListResponse>("/api/v1/datasources/types"),
    staleTime: 60_000,
  });

  const connectorTypes = useMemo(
    () => normalizeConnectorTypes(typesQuery.data?.items ?? []),
    [typesQuery.data?.items],
  );

  const typeById = useMemo(
    () => new Map(connectorTypes.map((item) => [item.type, item])),
    [connectorTypes],
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.datasources.list(listParams),
    queryFn: () => {
      const params = new URLSearchParams({
        limit: String(listParams.limit),
        offset: String(listParams.offset),
      });
      if (debouncedQ) params.set("q", debouncedQ);
      if (typeFilter !== ALL_TYPES) params.set("type", typeFilter);
      const qs = params.toString();
      return apiFetch<DataSourceListResponse>(
        `/api/v1/datasources${qs ? `?${qs}` : ""}`,
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/datasources/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setDeleteTarget(null);
      setDeleteError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.datasources.all });
    },
    onError: (err) => setDeleteError(mapApiError(err)),
  });

  const items = useMemo(() => {
    const raw = (data?.items ?? []).filter((row) => !isManagedAnalyticsDatasource(row));
    return [...raw].sort((a, b) => {
      const aDemo = isProtectedDemoDatasource(a) ? 1 : 0;
      const bDemo = isProtectedDemoDatasource(b) ? 1 : 0;
      return bDemo - aDemo;
    });
  }, [data?.items]);
  const total = data?.total ?? 0;
  const rowIds = useMemo(() => items.map((item) => item.id), [items]);
  const selection = useListRowSelection(rowIds);
  const batch = useListBatchMode(selection.clear);
  const hasFilters = Boolean(debouncedQ || typeFilter !== ALL_TYPES);
  const isEmpty = !isLoading && items.length === 0;

  const handleBatchDelete = async () => {
    const ids = [...selection.selectedIds].filter((selectedId) => {
      const row = items.find((item) => item.id === selectedId);
      return row ? !isProtectedDemoDatasource(row) && !isManagedAnalyticsDatasource(row) : false;
    });
    if (ids.length === 0) return;
    setBatchDeleting(true);
    const { ok, failed } = await runBatchDelete(ids, (id) =>
      apiFetch(`/api/v1/datasources/${id}`, { method: "DELETE" }),
    );
    setBatchDeleting(false);
    setBatchDeleteOpen(false);
    selection.clear();
    await queryClient.invalidateQueries({ queryKey: queryKeys.datasources.all });
    if (failed === 0) toast.success(`已删除 ${ok} 个数据源`);
    else toast.warning(`已删除 ${ok} 个，${failed} 个删除失败（可能仍被引用）`);
  };

  return (
    <AdminPageShell
      layout="list"
      title="数据源"
      icon={
        <AdminPageHeaderIcon>
          <Database className="size-6" aria-hidden />
        </AdminPageHeaderIcon>
      }
      description="配置与管理数据库、文件及 API 连接，供图表与看板直接查询使用。"
      actions={
        <Button asChild variant="primary" size="sm">
          <Link to="/admin/datasources/new">
            <Plus className="size-4" aria-hidden />
            新建数据源
          </Link>
        </Button>
      }
    >
      <ListPageSection>
        {deleteError ? (
          <ListPageBody className="border-b py-3">
            <PageErrorBanner message={deleteError} onRetry={() => setDeleteError(null)} />
          </ListPageBody>
        ) : null}

        <ListPageToolbar
          filters={
            <>
              <div className="grid w-full gap-2 sm:max-w-xs">
                <Label className="sr-only">搜索数据源</Label>
                <SearchField
                  value={search}
                  onChange={setSearch}
                  placeholder="搜索名称或标识…"
                  aria-label="搜索数据源"
                />
              </div>
              <div className="grid w-full gap-2 sm:w-[168px]">
                <Label htmlFor="datasource-type-filter" className="sr-only">
                  连接器类型
                </Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger
                    id="datasource-type-filter"
                    className="h-11"
                    aria-label="按连接器类型筛选"
                  >
                    <SelectValue placeholder="全部类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_TYPES}>全部类型</SelectItem>
                    {connectorTypes.map((item) => (
                      <SelectItem key={item.type} value={item.type}>
                        {item.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          }
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <ListPageBatchActions
                batchMode={batch.batchMode}
                onToggleBatchMode={batch.toggleBatchMode}
                selectedCount={selection.selectedCount}
                entityLabel="个数据源"
                onClear={selection.clear}
                onDelete={() => setBatchDeleteOpen(true)}
              />
              {!isLoading && data && hasFilters ? (
                <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                  筛选结果 {items.length} 条
                </p>
              ) : null}
            </div>
          }
        />

        <ListPageTableFrame className={cn(isEmpty && !isLoading ? "px-0" : undefined)}>
          {isError ? (
            <div className="px-5 pb-5">
              <PageErrorBanner message={mapApiError(error)} onRetry={() => void refetch()} />
            </div>
          ) : (
            <DataTable
              loading={isLoading}
              empty={isEmpty}
              lastColumnAlign="right"
              loadingRows={5}
              headers={[
                ...(batch.batchMode
                  ? [
                      <ListHeaderCheckbox
                        key="select-all"
                        checked={selection.allSelected}
                        indeterminate={selection.someSelected}
                        disabled={items.length === 0}
                        onCheckedChange={() => selection.toggleAll()}
                      />,
                    ]
                  : []),
                "数据源",
                "连接器",
                "连接信息",
                "操作",
              ]}
              emptyState={{
                icon: <Database className="size-7" aria-hidden />,
                title: hasFilters ? "未找到匹配的数据源" : "暂无数据源",
                description: hasFilters
                  ? "尝试调整搜索关键词或连接器类型筛选。"
                  : "添加第一个外部连接，即可在图表与看板中直接查询数据。",
                action: hasFilters ? undefined : (
                  <Button asChild variant="primary" size="sm">
                    <Link to="/admin/datasources/new">
                      <Plus className="size-4" aria-hidden />
                      新建数据源
                    </Link>
                  </Button>
                ),
              }}
              rows={items.map((row) => {
                const meta = typeById.get(row.type);
                const endpoint = formatConnectionEndpoint(row);

                const isLocked = isProtectedDemoDatasource(row);
                return [
                  ...(batch.batchMode
                    ? [
                        <ListRowCheckbox
                          key={`${row.id}-select`}
                          checked={selection.isSelected(row.id)}
                          disabled={isLocked}
                          onCheckedChange={() => selection.toggle(row.id)}
                          ariaLabel={`选择数据源 ${row.name}`}
                        />,
                      ]
                    : []),
                  <div key={`${row.id}-name`} className="min-w-[180px]">
                    <Link
                      to={`/admin/datasources/${row.id}`}
                      className="group inline-block max-w-full"
                    >
                      <span className="font-medium text-gray-900 transition-colors group-hover:text-brand-500 dark:text-white/90">
                        {row.name}
                      </span>
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <code className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-theme-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">
                        {row.code}
                      </code>
                      {isLocked ? (
                        <Badge variant="light" color="primary" size="sm">
                          官方示例数据
                        </Badge>
                      ) : null}
                      {isAnalyticsDatasource(row.code) ? (
                        <Badge variant="light" color="success" size="sm">
                          托管分析库
                        </Badge>
                      ) : null}
                      {!isAnalyticsDatasource(row.code)
                      && (typeById.get(row.type)?.queryCapable ?? isSyncSourceCapable(row.type)) ? (
                        <Badge variant="light" color="light" size="sm">
                          可作同步源
                        </Badge>
                      ) : null}
                      {row.description?.trim() ? (
                        <TruncateHint
                          title={row.description.trim()}
                          className="max-w-[220px] text-theme-xs text-gray-500 dark:text-gray-400"
                        >
                          {row.description.trim()}
                        </TruncateHint>
                      ) : null}
                    </div>
                  </div>,
                  <DatasourceTypeCell key={`${row.id}-type`} type={row.type} meta={meta} />,
                  <div key={`${row.id}-conn`} className="min-w-[160px]">
                    <p className="font-mono text-theme-sm text-gray-800 dark:text-white/90">
                      {endpoint.primary}
                    </p>
                    {endpoint.secondary ? (
                      <TruncateHint
                        title={endpoint.secondary}
                        as="p"
                        className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400"
                      >
                        {endpoint.secondary}
                      </TruncateHint>
                    ) : null}
                  </div>,
                  <RowActions key={`${row.id}-actions`}>
                    <IconButton asChild variant="ghost" size="sm" aria-label={`查看 ${row.name}`}>
                      <Link to={`/admin/datasources/${row.id}`}>
                        <Eye className="size-4" />
                      </Link>
                    </IconButton>
                    <IconButton
                      asChild={!isLocked}
                      variant="ghost"
                      size="sm"
                      aria-label={`编辑 ${row.name}`}
                      disabled={isLocked}
                      title={isLocked ? "官方示例数据连接不可修改" : undefined}
                    >
                      {isLocked ? (
                        <span className="inline-flex">
                          <Pencil className="size-4 opacity-40" />
                        </span>
                      ) : (
                        <Link to={`/admin/datasources/${row.id}/edit`}>
                          <Pencil className="size-4" />
                        </Link>
                      )}
                    </IconButton>
                    <DeleteRowIconButton
                      label={`删除 ${row.name}`}
                      disabled={isLocked}
                      disabledTitle="官方示例数据连接不可删除"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(row);
                      }}
                    />
                  </RowActions>,
                ];
              })}
            />
          )}
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

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除数据源？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{deleteTarget?.name}」。若数据源仍被图表或看板引用，删除将失败。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className={DESTRUCTIVE_ALERT_ACTION_CLASS}
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "删除中…" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BatchDeleteDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        count={selection.selectedCount}
        title="批量删除数据源"
        description={`确定删除选中的 ${selection.selectedCount} 个数据源？若仍被图表或看板引用，部分项可能删除失败。`}
        pending={batchDeleting}
        onConfirm={() => void handleBatchDelete()}
      />
    </AdminPageShell>
  );
}
