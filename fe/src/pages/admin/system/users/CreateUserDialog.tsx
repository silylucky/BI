import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AdminFormDialogBody,
  AdminFormDialogContent,
  AdminFormDialogFooter,
  AdminFormDialogHeader,
  AdminFormField,
} from "@/components/layout/admin-form-dialog";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { mapUserError } from "./userErrors";
import {
  generateTemporaryPassword,
  MIN_INITIAL_PASSWORD_LENGTH,
} from "./userPasswordUtils";

type CreateUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    username: string;
    password: string;
  } | null>(null);

  const resetForm = () => {
    setUsername("");
    setInitialPassword("");
    setError(null);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const trimmedUsername = username.trim();
      const trimmedPassword = initialPassword.trim();
      if (!trimmedUsername) throw new Error("请输入用户名");
      if (trimmedPassword.length < MIN_INITIAL_PASSWORD_LENGTH) {
        throw new Error(`初始密码至少 ${MIN_INITIAL_PASSWORD_LENGTH} 个字符`);
      }
      await apiFetch("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          username: trimmedUsername,
          initialPassword: trimmedPassword,
        }),
      });
      return { username: trimmedUsername, password: trimmedPassword };
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      onOpenChange(false);
      resetForm();
      setCreatedCredentials(result);
    },
    onError: (err) => {
      if (
        err instanceof Error &&
        (err.message.startsWith("请输入") || err.message.includes("密码至少"))
      ) {
        setError(err.message);
        return;
      }
      setError(mapUserError(err));
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handleCopyPassword = async () => {
    if (!createdCredentials) return;
    try {
      await navigator.clipboard.writeText(createdCredentials.password);
      toast.success("密码已复制");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <AdminFormDialogContent>
          <AdminFormDialogHeader>
            <DialogTitle>创建用户</DialogTitle>
          </AdminFormDialogHeader>
          <AdminFormDialogBody>
            <AdminFormField label="用户名" htmlFor="new-username">
              <Input
                id="new-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
              />
            </AdminFormField>
            <AdminFormField
              label={
                <span className="flex w-full items-center justify-between gap-2">
                  初始密码
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0"
                    onClick={() => setInitialPassword(generateTemporaryPassword())}
                  >
                    生成随机密码
                  </Button>
                </span>
              }
              htmlFor="new-password"
              hint="创建成功后请妥善交付初始密码；用户首次登录后建议修改。"
              error={error}
            >
              <Input
                id="new-password"
                type="text"
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                autoComplete="new-password"
                placeholder={`至少 ${MIN_INITIAL_PASSWORD_LENGTH} 个字符`}
              />
            </AdminFormField>
          </AdminFormDialogBody>
          <AdminFormDialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={createMutation.isPending}
              onClick={() => {
                setError(null);
                createMutation.mutate();
              }}
            >
              {createMutation.isPending ? "创建中…" : "创建"}
            </Button>
          </AdminFormDialogFooter>
        </AdminFormDialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(createdCredentials)}
        onOpenChange={(o) => !o && setCreatedCredentials(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>用户已创建</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left">
                <p>
                  请将以下初始密码交给用户 <strong>{createdCredentials?.username}</strong>：
                </p>
                <p className="break-all rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-theme-sm dark:border-gray-800 dark:bg-white/[0.04]">
                  {createdCredentials?.password}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction variant="primary" onClick={() => void handleCopyPassword()}>
              复制密码
            </AlertDialogAction>
            <AlertDialogAction variant="primary" onClick={() => setCreatedCredentials(null)}>关闭</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
