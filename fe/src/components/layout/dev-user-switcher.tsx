import * as React from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/auth-context";
import {
  fetchDevSwitchableUsers,
  isDevUserSwitchEnabled,
  switchDevUser,
  type DevSwitchableUser,
} from "@/lib/dev-user-switch";
import { mapApiError } from "@/lib/apiError";
import { primaryRoleLabel } from "@/lib/session";
import { WORKSPACE_HOME_PATH } from "@/lib/workspace";
import { cn } from "@/lib/utils";

type DevUserSwitcherProps = {
  currentUsername: string;
  onSwitched?: () => void;
  className?: string;
};

export function DevUserSwitcher({
  currentUsername,
  onSwitched,
  className,
}: DevUserSwitcherProps) {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [users, setUsers] = React.useState<DevSwitchableUser[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [switching, setSwitching] = React.useState<string | null>(null);
  const loadedRef = React.useRef(false);

  const loadUsers = React.useCallback(async () => {
    if (!isDevUserSwitchEnabled()) return;
    setLoading(true);
    setError(null);
    try {
      const items = await fetchDevSwitchableUsers();
      setUsers(items);
      loadedRef.current = true;
    } catch (err) {
      const message = mapApiError(err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadedRef.current = false;
    void loadUsers();
  }, [currentUsername, loadUsers]);

  if (!isDevUserSwitchEnabled()) return null;

  const handleSwitch = async (username: string) => {
    if (username === currentUsername || switching) return;
    setSwitching(username);
    setError(null);
    try {
      const landing = await switchDevUser(username);
      await refresh();
      navigate(landing ?? WORKSPACE_HOME_PATH, { replace: true });
      toast.success(`已切换为 ${username}`);
      onSwitched?.();
    } catch (err) {
      const message = mapApiError(err);
      setError(message);
      toast.error(message);
    } finally {
      setSwitching(null);
    }
  };

  const switchableUsers = users.filter((item) => item.username !== currentUsername);

  return (
    <div className={cn("border-b border-gray-200 pb-3 dark:border-gray-800", className)}>
      <DropdownMenuLabel className="flex items-center gap-2 px-3 py-1.5 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
        <Users className="size-4" aria-hidden />
        切换其他用户
      </DropdownMenuLabel>
      <p className="px-3 pb-2 text-theme-xs text-gray-500 dark:text-gray-400">
        开发模式：以不同角色体验权限差异
      </p>
      {error ? (
        <p className="px-3 pb-2 text-theme-xs text-error-600 dark:text-error-400" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
        {loading ? (
          <li className="px-3 py-2 text-theme-xs text-gray-500">加载用户列表…</li>
        ) : users.length === 0 ? (
          <li className="px-3 py-2 text-theme-xs text-gray-500">暂无用户，请检查后端连接</li>
        ) : switchableUsers.length === 0 ? (
          <li className="px-3 py-2 text-theme-xs text-gray-500">
            仅当前账号。已执行迁移 0018 后应出现 analyst / viewer；否则到用户管理创建并绑定角色。
          </li>
        ) : (
          switchableUsers.map((item) => {
            const busy = switching === item.username;
            return (
              <li key={item.id}>
                <DropdownMenuItem
                  disabled={Boolean(switching)}
                  onSelect={(event) => {
                    event.preventDefault();
                    void handleSwitch(item.username);
                  }}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-theme-sm text-gray-800 dark:text-white/90">
                    {item.username}
                  </span>
                  <Badge variant="light" color="primary" size="sm">
                    {primaryRoleLabel(item.roles)}
                  </Badge>
                  {busy ? (
                    <span className="text-theme-xs text-gray-500">切换中…</span>
                  ) : null}
                </DropdownMenuItem>
              </li>
            );
          })
        )}
      </ul>
      <DropdownMenuSeparator className="my-0" />
    </div>
  );
}
