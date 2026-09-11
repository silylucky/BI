import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { mapUserError } from "./userErrors";

type ResourceGrantRow = {
  id: string;
  resourceType: string;
  resourceId: string;
  effect: "add" | "deny";
};

type UserOverrideGrantsPanelProps = {
  userId: string;
  onActionError: (message: string | null) => void;
};

export function UserOverrideGrantsPanel({ userId, onActionError }: UserOverrideGrantsPanelProps) {
  const queryClient = useQueryClient();
  const [resourceType, setResourceType] = useState("dashboard");
  const [resourceId, setResourceId] = useState("");
  const [effect, setEffect] = useState<"add" | "deny">("add");

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.users.resourceGrants(userId),
    queryFn: () =>
      apiFetch<{ items: ResourceGrantRow[] }>(`/api/v1/users/${userId}/resource-grants`).then(
        (r) => r.items,
      ),
    enabled: Boolean(userId),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/users/${userId}/resource-grants`, {
        method: "PUT",
        body: JSON.stringify({
          resource_type: resourceType,
          resource_id: resourceId.trim(),
          effect,
        }),
      }),
    onSuccess: async () => {
      toast.success("例外授权已保存");
      onActionError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.users.resourceGrants(userId) });
    },
    onError: (err) => onActionError(mapUserError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (grantId: string) =>
      apiFetch(`/api/v1/users/${userId}/resource-grants/${grantId}`, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("已移除例外授权");
      await queryClient.invalidateQueries({ queryKey: queryKeys.users.resourceGrants(userId) });
    },
    onError: (err) => onActionError(mapUserError(err)),
  });

  const items = data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">
        在用户角色授权基础上追加或拒绝资源访问；有效权限 = 角色授权 ∪ 追加 − 拒绝。
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select value={resourceType} onValueChange={setResourceType}>
          <SelectTrigger aria-label="资源类型">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dashboard">仪表板</SelectItem>
            <SelectItem value="datasource">数据源</SelectItem>
            <SelectItem value="report">报表</SelectItem>
          </SelectContent>
        </Select>
        <Select value={effect} onValueChange={(v) => setEffect(v as "add" | "deny")}>
          <SelectTrigger aria-label="授权效果">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="add">追加授权</SelectItem>
            <SelectItem value="deny">显式拒绝</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="sm:col-span-2"
          placeholder="资源 ID（UUID）"
          value={resourceId}
          onChange={(e) => setResourceId(e.target.value)}
          aria-label="资源 ID"
        />
      </div>
      <Button
        type="button"
        variant="primary"
        disabled={!resourceId.trim() || saveMutation.isPending}
        onClick={() => saveMutation.mutate()}
      >
        {saveMutation.isPending ? "保存中…" : "添加例外授权"}
      </Button>
      <ul className="divide-y rounded-xl border border-gray-200 dark:border-gray-800">
        {isLoading ? (
          <li className="px-4 py-3 text-theme-sm text-gray-500">加载中…</li>
        ) : null}
        {!isLoading && items.length === 0 ? (
          <li className="px-4 py-3 text-theme-sm text-gray-500">暂无例外授权</li>
        ) : null}
        {items.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                {row.resourceType} · {row.effect === "add" ? "追加" : "拒绝"}
              </p>
              <p className="truncate font-mono text-theme-xs text-gray-500">{row.resourceId}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(row.id)}
            >
              移除
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
