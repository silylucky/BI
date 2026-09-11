import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
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
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { isUserLocked, type UserAccountFields } from "./userAccountStatus";
import { mapUserError } from "./userErrors";
import { UserSheetSection } from "./UserSheetSection";

type UserAccountStatusPanelProps = {
  userId: string;
  username: string;
  isActive: boolean;
  lockedUntil: string | null;
  onStatusChange: (status: UserAccountFields) => void;
  onActionError: (message: string | null) => void;
};

type UserStatusResponse = {
  isActive: boolean;
  lockedUntil: string | null;
};

export function UserAccountStatusPanel({
  userId,
  username,
  isActive,
  lockedUntil,
  onStatusChange,
  onActionError,
}: UserAccountStatusPanelProps) {
  const queryClient = useQueryClient();
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);
  const locked = isUserLocked(lockedUntil);

  const statusMutation = useMutation({
    mutationFn: async (action: "disable" | "enable" | "unlock") => {
      const res = await apiFetch<UserStatusResponse>(`/api/v1/users/${userId}/${action}`, {
        method: "POST",
      });
      return res;
    },
    onSuccess: async (res, action) => {
      onStatusChange({ isActive: res.isActive, lockedUntil: res.lockedUntil ?? null });
      onActionError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      if (action === "disable") setDisableConfirmOpen(false);
      toast.success(
        action === "disable" ? "账号已停用" : action === "enable" ? "账号已启用" : "账号已解锁",
      );
    },
    onError: (err) => {
      setDisableConfirmOpen(false);
      onActionError(mapUserError(err));
    },
  });

  const actions = (
    <div className="flex flex-wrap gap-2">
      {isActive ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDisableConfirmOpen(true)}
          disabled={statusMutation.isPending}
        >
          停用账号
        </Button>
      ) : (
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => statusMutation.mutate("enable")}
          disabled={statusMutation.isPending}
        >
          {statusMutation.isPending ? "启用中…" : "重新启用"}
        </Button>
      )}
      {locked ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => statusMutation.mutate("unlock")}
          disabled={statusMutation.isPending}
        >
          {statusMutation.isPending ? "解锁中…" : "解除锁定"}
        </Button>
      ) : null}
    </div>
  );

  return (
    <>
      <UserSheetSection
        title="账号状态"
        description="停用后用户无法登录；多次登录失败会自动锁定，可在此解锁。"
        icon={<ShieldCheck className="size-4" aria-hidden />}
        footer={actions}
      />

      <AlertDialog open={disableConfirmOpen} onOpenChange={setDisableConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认停用账号？</AlertDialogTitle>
            <AlertDialogDescription>
              停用后用户「{username}」将无法登录，已发放的会话也会失效。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="primary"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate("disable")}
            >
              {statusMutation.isPending ? "停用中…" : "确认停用"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
