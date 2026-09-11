import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import {
  BatchDeleteDialog,
  DESTRUCTIVE_ALERT_ACTION_CLASS,
  ListHeaderCheckbox,
  ListPageBatchActions,
  listTableSelectHeadClass,
} from "@/components/layout/list-batch-delete";
import {
  ListPagePagination,
  ListPageSection,
  ListPageTableFrame,
  ListPageToolbar,
} from "@/components/layout/list-page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { useListPagination } from "@/lib/list-pagination";
import { CreateUserDialog } from "./CreateUserDialog";
import { SystemAdminListHint } from "../SystemAdminListHint";
import { UserListRow, type UserRow } from "./UserListRow";
import { UserManageSheet } from "./UserManageSheet";
import { mapUserError } from "./userErrors";
import { useUserBatchDelete } from "./useUserBatchDelete";

function UserRoleBadges({ roles }: { roles?: UserRow["roles"] }) {
  if (!roles?.length) return <span className="text-gray-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <Badge key={r.id} variant="light" color="primary" size="sm">
          {r.name}
        </Badge>
      ))}
    </div>
  );
}

export function UserListPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [sheetUser, setSheetUser] = useState<UserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const pagination = useListPagination(undefined, [debouncedQ]);

  const listParams = useMemo(
    () => ({
      limit: pagination.pageSize,
      offset: pagination.offset,
      ...(debouncedQ ? { q: debouncedQ } : {}),
    }),
    [debouncedQ, pagination.pageSize, pagination.offset],
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.users.list(listParams),
    queryFn: () => {
      const params = new URLSearchParams({
        limit: String(pagination.pageSize),
        offset: String(pagination.offset),
      });
      if (debouncedQ) params.set("q", debouncedQ);
      return apiFetch<{ items: UserRow[]; total: number }>(`/api/v1/users?${params}`);
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
  };

  const {
    selection,
    batch,
    batchDeleteOpen,
    setBatchDeleteOpen,
    batchDeleting,
    handleBatchDelete,
  } = useUserBatchDelete(items, invalidate);

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => apiFetch(`/api/v1/users/${userId}`, { method: "DELETE" }),
    onSuccess: async (_data, userId) => {
      toast.success("用户已删除");
      setDeleteUser(null);
      if (sheetUser?.id === userId) setSheetUser(null);
      setActionError(null);
      await invalidate();
    },
    onError: (err) => {
      setDeleteUser(null);
      setActionError(mapUserError(err));
    },
  });

  const colSpan = batch.batchMode ? 5 : 4;

  return (
    <AdminPageShell
      layout="list"
      title="用户管理"
      description="创建用户、分配角色与组织归属，并可重置登录密码。"
      actions={
        <Button type="button" variant="primary" onClick={() => setCreateOpen(true)}>
          创建用户
        </Button>
      }
    >
      <ListPageSection>
        <SystemAdminListHint scope="users" />
        <ListPageToolbar
          filters={
            <Input
              className="max-w-md"
              placeholder="搜索用户名…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="搜索用户"
            />
          }
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <ListPageBatchActions
                batchMode={batch.batchMode}
                onToggleBatchMode={batch.toggleBatchMode}
                selectedCount={selection.selectedCount}
                entityLabel="个用户"
                onClear={selection.clear}
                onDelete={() => setBatchDeleteOpen(true)}
              />
              {!isLoading ? (
                <p className="text-theme-sm text-gray-500 dark:text-gray-400">共 {total} 个用户</p>
              ) : null}
            </div>
          }
        />

        {isError ? (
          <div className="shrink-0 border-b border-gray-100 px-5 py-3 dark:border-white/[0.06]">
            <PageErrorBanner message={mapApiError(error)} onRetry={() => void refetch()} />
          </div>
        ) : null}
        {actionError ? (
          <div className="shrink-0 border-b border-gray-100 px-5 py-3 dark:border-white/[0.06]">
            <PageErrorBanner message={actionError} onRetry={() => setActionError(null)} />
          </div>
        ) : null}

        <ListPageTableFrame>
          <div className="overflow-x-only">
            <table className="min-w-[640px] w-full text-left text-theme-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02]">
                <tr>
                  {batch.batchMode ? (
                    <th className={listTableSelectHeadClass}>
                      <ListHeaderCheckbox
                        checked={selection.allSelected}
                        indeterminate={selection.someSelected}
                        disabled={items.length === 0}
                        onCheckedChange={() => selection.toggleAll()}
                      />
                    </th>
                  ) : null}
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">用户名</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">状态</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    已绑定角色
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="px-4 py-3" colSpan={colSpan}>
                          <Skeleton className="h-6 w-full" />
                        </td>
                      </tr>
                    ))
                  : null}
                {!isLoading && items.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                      colSpan={colSpan}
                    >
                      暂无用户
                    </td>
                  </tr>
                ) : null}
                {!isLoading
                  ? items.map((row) => (
                      <UserListRow
                        key={row.id}
                        row={row}
                        batchMode={batch.batchMode}
                        isSelected={selection.isSelected(row.id)}
                        onToggleSelect={() => selection.toggle(row.id)}
                        onManage={(user) => {
                          setSheetUser(user);
                          setActionError(null);
                        }}
                        onDelete={setDeleteUser}
                        roleBadges={<UserRoleBadges roles={row.roles} />}
                      />
                    ))
                  : null}
              </tbody>
            </table>
          </div>
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

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <UserManageSheet
        user={sheetUser}
        onOpenChange={(open) => !open && setSheetUser(null)}
        onActionError={setActionError}
        onUserChange={setSheetUser}
      />

      <AlertDialog open={Boolean(deleteUser)} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除用户？</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除用户「{deleteUser?.username}」及其角色绑定，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              className={DESTRUCTIVE_ALERT_ACTION_CLASS}
              disabled={deleteMutation.isPending}
              onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
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
        title="确认批量删除用户？"
        description={`将永久删除选中的 ${selection.selectedCount} 个用户及其角色绑定，此操作不可恢复。超级管理员与当前登录账号将自动跳过。`}
        pending={batchDeleting}
        onConfirm={() => void handleBatchDelete()}
      />
    </AdminPageShell>
  );
}
