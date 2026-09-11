import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import type { DimensionTypeOut, RoleOut } from "./rls-types";

type OrgOut = { id: string; name: string; path: string };

type RoleDimensionValuesOut = {
  roleId: string;
  dimensionTypeId: string;
  values: string[];
  version: number;
};

type Props = {
  dimensions: DimensionTypeOut[];
};

export function RlsDimensionValuesPanel({ dimensions }: Props) {
  const qc = useQueryClient();
  const [roleId, setRoleId] = useState("");
  const [dimId, setDimId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [textValue, setTextValue] = useState("");
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const loadedValuesRef = useRef<string[]>([]);

  const rolesQuery = useQuery({
    queryKey: queryKeys.roles.list({ limit: 100, offset: 0 }),
    queryFn: () =>
      apiFetch<{ items: RoleOut[]; total: number }>("/api/v1/roles?limit=100&offset=0"),
  });

  const orgsQuery = useQuery({
    queryKey: queryKeys.orgs.picker,
    queryFn: () => apiFetch<{ items: OrgOut[] }>("/api/v1/orgs?limit=500&offset=0"),
    enabled: dimensions.some((d) => d.id === dimId && d.value_type === "org_ref"),
  });

  const bindingsQuery = useQuery({
    queryKey: queryKeys.roles.dimensionValues(roleId, dimId),
    queryFn: () =>
      apiFetch<RoleDimensionValuesOut>(
        `/api/v1/roles/${roleId}/dimension-values?dimensionTypeId=${dimId}`,
      ),
    enabled: Boolean(roleId && dimId),
  });

  const selectedDim = dimensions.find((d) => d.id === dimId);
  const isOrgRef = selectedDim?.value_type === "org_ref";

  useEffect(() => {
    if (!roleId || !dimId) {
      setSelected(new Set());
      loadedValuesRef.current = [];
      return;
    }
    if (!bindingsQuery.data) return;
    const vals = bindingsQuery.data.values ?? [];
    loadedValuesRef.current = vals;
    setSelected(new Set(vals));
  }, [roleId, dimId, bindingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (confirmEmpty: boolean) =>
      apiFetch(`/api/v1/roles/${roleId}/dimension-values`, {
        method: "PUT",
        body: JSON.stringify({
          dimensionTypeId: dimId,
          values: Array.from(selected),
          expectedVersion: bindingsQuery.data?.version ?? 0,
          confirmEmpty,
        }),
      }),
    onSuccess: async () => {
      toast.success("角色维度值已绑定");
      setClearConfirmOpen(false);
      await qc.invalidateQueries({ queryKey: queryKeys.roles.dimensionValues(roleId, dimId) });
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const toggle = (value: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(value);
      else next.delete(value);
      return next;
    });
  };

  const addTextValue = () => {
    const v = textValue.trim();
    if (!v) return;
    setSelected((prev) => new Set(prev).add(v));
    setTextValue("");
  };

  const handleSave = () => {
    if (!roleId || !dimId) return;
    const clearing = selected.size === 0 && loadedValuesRef.current.length > 0;
    if (clearing) {
      setClearConfirmOpen(true);
      return;
    }
    saveMutation.mutate(selected.size === 0);
  };

  const roles = (rolesQuery.data?.items ?? []).filter((r) => r.isActive);
  const orgs = orgsQuery.data?.items ?? [];

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
      <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">维度值直绑</p>
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">
        为角色直接绑定维度成员值（组织维度请选 org_ref 类型并使用组织选择器）。
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>角色</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger aria-label="选择角色">
              <SelectValue placeholder="选择角色" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>维度类型</Label>
          <Select value={dimId} onValueChange={setDimId}>
            <SelectTrigger aria-label="选择维度类型">
              <SelectValue placeholder="选择维度" />
            </SelectTrigger>
            <SelectContent>
              {dimensions.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                  {d.value_type === "org_ref" ? "（组织）" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {bindingsQuery.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !roleId || !dimId ? (
        <p className="text-theme-sm text-gray-500">请先选择角色与维度类型</p>
      ) : isOrgRef ? (
        <ul className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
          {orgs.map((org) => (
            <li key={org.id} className="flex items-center gap-2">
              <Checkbox
                id={`org-val-${org.id}`}
                checked={selected.has(org.id)}
                onCheckedChange={(v) => toggle(org.id, v === true)}
              />
              <Label htmlFor={`org-val-${org.id}`} className="cursor-pointer text-theme-sm">
                {org.name}
              </Label>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="输入维度值后添加"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTextValue();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={addTextValue}>
              添加
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from(selected).map((v) => (
              <Button
                key={v}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => toggle(v, false)}
              >
                {v} ×
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          disabled={!roleId || !dimId || saveMutation.isPending}
          onClick={handleSave}
        >
          保存维度值
        </Button>
      </div>

      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清空维度值绑定？</AlertDialogTitle>
            <AlertDialogDescription>
              将移除该角色在此维度下的全部直绑值，可能影响数据可见范围。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => saveMutation.mutate(true)}>确认清空</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
