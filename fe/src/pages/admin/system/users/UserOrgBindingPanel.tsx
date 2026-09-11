import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiRequestError, apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { mapUserError } from "./userErrors";
import { UserSheetSection } from "./UserSheetSection";

type OrgOut = { id: string; parent_id: string | null; name: string; path: string; level: number };

type UserOrgBindingPanelProps = {
  userId: string;
  onActionError: (message: string | null) => void;
};

export function UserOrgBindingPanel({ userId, onActionError }: UserOrgBindingPanelProps) {
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("__none__");

  const { data: orgs, isLoading: orgsLoading } = useQuery({
    queryKey: queryKeys.orgs.picker,
    queryFn: () => apiFetch<{ items: OrgOut[] }>("/api/v1/orgs?limit=500&offset=0"),
  });

  const {
    data: userOrg,
    isLoading: userOrgLoading,
    isError: userOrgIsError,
    error: userOrgError,
  } = useQuery({
    queryKey: queryKeys.users.org(userId),
    queryFn: async () => {
      try {
        return await apiFetch<OrgOut>(`/api/v1/users/${userId}/org`);
      } catch (err) {
        if (err instanceof ApiRequestError && err.code === "USER_ORG_NOT_SET") {
          return null;
        }
        throw err;
      }
    },
  });

  useEffect(() => {
    setSelectedOrgId(userOrg?.id ?? "__none__");
  }, [userOrg?.id]);

  const saveOrgMutation = useMutation({
    mutationFn: async () => {
      if (selectedOrgId === "__none__") {
        await apiFetch(`/api/v1/users/${userId}/org`, { method: "DELETE" });
        return;
      }
      await apiFetch(`/api/v1/users/${userId}/org`, {
        method: "PUT",
        body: JSON.stringify({ org_node_id: selectedOrgId }),
      });
    },
    onSuccess: async () => {
      toast.success("组织归属已更新");
      onActionError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.users.org(userId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
    onError: (err) => onActionError(mapUserError(err)),
  });

  const orgItems = orgs?.items ?? [];
  const loading = orgsLoading || userOrgLoading;

  return (
    <UserSheetSection
      title="所属组织"
      description="用于行级权限与数据范围过滤，建议为业务用户分配明确组织。"
      icon={<Building2 className="size-4" aria-hidden />}
      footer={
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="w-full"
          disabled={saveOrgMutation.isPending || loading}
          onClick={() => saveOrgMutation.mutate()}
        >
          {saveOrgMutation.isPending ? "保存中…" : "保存组织归属"}
        </Button>
      }
    >
      <div className="grid gap-2">
        <Label htmlFor="user-org" className="sr-only">
          所属组织
        </Label>
        {loading ? (
          <Skeleton className="h-11 w-full rounded-lg" />
        ) : userOrgIsError && !(userOrgError instanceof ApiRequestError) ? (
          <p className="text-theme-xs text-error-600">{mapApiError(userOrgError)}</p>
        ) : (
          <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
            <SelectTrigger id="user-org" aria-label="选择组织" className="h-11">
              <SelectValue placeholder="未分配组织" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">（未分配）</SelectItem>
              {orgItems.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  <span className="truncate">{org.name}</span>
                  <span className="ml-2 font-mono text-theme-xs text-gray-400">{org.path}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </UserSheetSection>
  );
}
