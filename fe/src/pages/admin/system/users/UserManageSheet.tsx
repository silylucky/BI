import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { mapUserError } from "./userErrors";
import { UserAccountStatusPanel } from "./UserAccountStatusPanel";
import { UserOrgBindingPanel } from "./UserOrgBindingPanel";
import { UserResetPasswordPanel } from "./UserResetPasswordPanel";
import { UserOverrideGrantsPanel } from "./UserOverrideGrantsPanel";
import { isUserLocked, type UserAccountFields } from "./userAccountStatus";

type UserOut = { id: string; username: string; email?: string | null } & UserAccountFields;
type RoleOut = { id: string; code: string; name: string; isActive?: boolean };

type UserManageSheetProps = {
  user: UserOut | null;
  onOpenChange: (open: boolean) => void;
  onActionError: (message: string | null) => void;
  onUserChange?: (user: UserOut) => void;
};

export function UserManageSheet({
  user,
  onOpenChange,
  onActionError,
  onUserChange,
}: UserManageSheetProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"roles" | "org" | "overrides">("roles");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [accountStatus, setAccountStatus] = useState<Required<UserAccountFields>>({
    isActive: true,
    lockedUntil: null,
  });

  const { data: rolesCatalog, isLoading: rolesCatalogLoading } = useQuery({
    queryKey: queryKeys.roles.list({ limit: 500, offset: 0 }),
    queryFn: () =>
      apiFetch<{ items: RoleOut[]; total: number }>("/api/v1/roles?limit=500&offset=0"),
    enabled: Boolean(user),
  });
  const allRoles = rolesCatalog?.items ?? [];

  const { data: boundRoles, isLoading: rolesLoading } = useQuery({
    queryKey: user ? queryKeys.users.roles(user.id) : ["noop"],
    queryFn: () =>
      apiFetch<{ items: RoleOut[] }>(`/api/v1/users/${user!.id}/roles`).then((r) => r.items),
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (boundRoles) setSelectedRoleIds(boundRoles.map((r) => r.id));
  }, [boundRoles]);

  useEffect(() => {
    if (!user) setTab("roles");
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setAccountStatus({
      isActive: user.isActive ?? true,
      lockedUntil: user.lockedUntil ?? null,
    });
  }, [user]);

  const saveRolesMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await apiFetch(`/api/v1/users/${user.id}/roles`, {
        method: "PUT",
        body: JSON.stringify({ role_ids: selectedRoleIds }),
      });
    },
    onSuccess: async () => {
      toast.success("角色已更新");
      onActionError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
    onError: (err) => onActionError(mapUserError(err)),
  });

  const toggleRole = (roleId: string, checked: boolean) => {
    setSelectedRoleIds((prev) =>
      checked ? [...prev, roleId] : prev.filter((id) => id !== roleId),
    );
  };

  const locked = user ? isUserLocked(accountStatus.lockedUntil) : false;
  const statusLabel = locked ? "已锁定" : accountStatus.isActive ? "正常" : "已停用";
  const statusColor = locked ? "warning" : accountStatus.isActive ? "success" : "error";

  return (
    <Sheet open={Boolean(user)} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="edit" className="flex flex-col gap-0 p-0">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-3 pr-8 text-title-sm">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shadow-theme-xs dark:bg-brand-500/10 dark:text-brand-400">
              <UserRound className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 truncate">{user?.username}</span>
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <span>管理角色绑定、组织归属、联系方式与账号安全。</span>
            {user ? (
              <Badge variant="light" color={statusColor} size="sm">
                {statusLabel}
              </Badge>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "roles" | "org" | "overrides")}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-6 mt-4 grid w-[calc(100%-3rem)] grid-cols-3">
            <TabsTrigger value="roles" className="gap-1.5">
              <Shield className="size-3.5" aria-hidden />
              角色
            </TabsTrigger>
            <TabsTrigger value="org">组织与安全</TabsTrigger>
            <TabsTrigger value="overrides">例外授权</TabsTrigger>
          </TabsList>

          <TabsContent
            value="roles"
            className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <ScrollArea className="min-h-0 flex-1 px-6 py-4">
              <div className="grid gap-2.5" aria-label="选择角色">
                {rolesLoading || rolesCatalogLoading ? (
                  <>
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                  </>
                ) : null}
                {allRoles.map((role) => {
                  const selected = selectedRoleIds.includes(role.id);
                  return (
                    <label
                      key={role.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors",
                        selected
                          ? "border-brand-300 bg-brand-50/60 dark:border-brand-500/40 dark:bg-brand-500/10"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/80 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-white/[0.03]",
                        role.isActive === false && "opacity-60",
                      )}
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(c) => toggleRole(role.id, c === true)}
                        aria-label={role.name}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                          {role.name}
                        </p>
                        <p className="truncate font-mono text-theme-xs text-gray-500 dark:text-gray-400">
                          {role.code}
                        </p>
                      </div>
                      {role.isActive === false ? (
                        <Badge variant="light" color="light" size="sm">
                          已停用
                        </Badge>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
            <SheetFooter className="mt-auto">
              <Button
                type="button"
                variant="primary"
                className="w-full sm:w-auto"
                disabled={saveRolesMutation.isPending}
                onClick={() => saveRolesMutation.mutate()}
              >
                {saveRolesMutation.isPending ? "保存中…" : "保存角色绑定"}
              </Button>
            </SheetFooter>
          </TabsContent>

          <TabsContent
            value="org"
            className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
          >
            <div className="space-y-4 px-6 py-4">
              {user ? (
                <>
                  <UserAccountStatusPanel
                    userId={user.id}
                    username={user.username}
                    isActive={accountStatus.isActive}
                    lockedUntil={accountStatus.lockedUntil}
                    onStatusChange={(status) => {
                      setAccountStatus({
                        isActive: status.isActive ?? true,
                        lockedUntil: status.lockedUntil ?? null,
                      });
                      onUserChange?.({
                        ...user,
                        isActive: status.isActive,
                        lockedUntil: status.lockedUntil,
                      });
                    }}
                    onActionError={onActionError}
                  />
                  <UserOrgBindingPanel userId={user.id} onActionError={onActionError} />
                  <UserResetPasswordPanel
                    userId={user.id}
                    username={user.username}
                    onActionError={onActionError}
                  />
                </>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent
            value="overrides"
            className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
          >
            <div className="px-6 py-4">
              {user ? (
                <UserOverrideGrantsPanel userId={user.id} onActionError={onActionError} />
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
