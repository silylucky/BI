import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";

type PermissionOut = {
  id: string;
  code: string;
  name: string;
  domain: string;
  description?: string | null;
};

type RolePermissionsOut = {
  roleId: string;
  permissionCodes: string[];
  version: number;
  allPermissions: boolean;
};

const DOMAIN_LABELS: Record<string, string> = {
  system: "系统管理",
  datasource: "数据源",
  dashboard: "仪表板",
  viz: "可视化",
  report: "报表",
  dataset: "数据集",
  metadata: "元数据",
  governance: "治理",
  theme: "主题分析",
  ingestion: "数据集成",
};

type RolePermissionsPanelProps = {
  roleId: string;
  roleName: string;
  isRoot?: boolean;
};

export function RolePermissionsPanel({ roleId, roleName, isRoot }: RolePermissionsPanelProps) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const catalogQuery = useQuery({
    queryKey: queryKeys.permissions.catalog,
    queryFn: () => apiFetch<{ items: PermissionOut[] }>("/api/v1/permissions"),
  });

  const rolePermsQuery = useQuery({
    queryKey: queryKeys.permissions.role(roleId),
    queryFn: () => apiFetch<RolePermissionsOut>(`/api/v1/roles/${roleId}/permissions`),
    enabled: Boolean(roleId),
  });

  useEffect(() => {
    if (!rolePermsQuery.data) return;
    setSelected(new Set(rolePermsQuery.data.permissionCodes));
  }, [rolePermsQuery.data]);

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionOut[]>();
    for (const perm of catalogQuery.data?.items ?? []) {
      const list = map.get(perm.domain) ?? [];
      list.push(perm);
      map.set(perm.domain, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [catalogQuery.data?.items]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/roles/${roleId}/permissions`, {
        method: "PUT",
        body: JSON.stringify({
          permissionCodes: Array.from(selected),
          expectedVersion: rolePermsQuery.data?.version ?? 0,
        }),
      }),
    onSuccess: async () => {
      toast.success("角色权限已更新");
      await qc.invalidateQueries({ queryKey: queryKeys.permissions.role(roleId) });
      await qc.invalidateQueries({ queryKey: queryKeys.roles.all });
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const toggle = (code: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  };

  const loading = catalogQuery.isLoading || rolePermsQuery.isLoading;

  if (isRoot || rolePermsQuery.data?.allPermissions) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <Badge variant="light" color="warning" size="sm">
          超级管理员角色
        </Badge>
        <p className="mt-2 text-theme-sm text-gray-700 dark:text-gray-300">
          「{roleName}」拥有全部平台权限，无需单独配置权限点。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {catalogQuery.isError || rolePermsQuery.isError ? (
        <p className="text-theme-sm text-error-600 dark:text-error-400">
          {mapApiError(catalogQuery.error ?? rolePermsQuery.error)}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="max-h-[min(50vh,420px)] space-y-5 overflow-y-auto pr-1">
          {grouped.map(([domain, perms]) => (
            <section key={domain}>
              <h3 className="mb-2 text-theme-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {DOMAIN_LABELS[domain] ?? domain}
              </h3>
              <ul className="grid gap-2">
                {perms.map((perm) => (
                  <li key={perm.code}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800">
                      <Checkbox
                        checked={selected.has(perm.code)}
                        onCheckedChange={(v) => toggle(perm.code, v === true)}
                        aria-label={perm.name}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                          {perm.name}
                        </span>
                        {perm.description ? (
                          <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
                            {perm.description}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-white/[0.06]">
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          已选 {selected.size} 项权限
        </p>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={loading || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? "保存中…" : "保存权限"}
        </Button>
      </div>
    </div>
  );
}
