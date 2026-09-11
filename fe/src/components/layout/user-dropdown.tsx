import * as React from "react";
import { Link } from "react-router";
import { ArrowLeft, ChevronDown, LogOut, Settings, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/context/workspace-context";
import { useAuth } from "@/context/auth-context";
import {
  primaryRoleLabel,
  sessionUserFromMe,
  canManagePlatform,
} from "@/lib/session";
import { ACCOUNT_CENTER_PATH, SYSTEM_ADMIN_HOME_PATH } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export function UserDropdown({ className }: { className?: string }) {
  const { user: authUser, logout } = useAuth();
  const user = authUser
    ? sessionUserFromMe(authUser)
    : sessionUserFromMe({ username: "用户", displayName: "用户", email: "user@vitalspan.local", roles: ["viewer"] });
  const label = user.name;
  const roleLabel = primaryRoleLabel(user.roles);
  const { canReturnToWorkspace, returnToWorkspace, beginAccountManagement, beginSystemAdmin } =
    useWorkspace();
  const canOpenSystemAdmin = canManagePlatform(user);
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "dropdown-toggle flex items-center gap-2 rounded-lg px-2 py-1.5 text-gray-700 transition-colors",
            "hover:bg-gray-100 focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/10",
            "dark:text-gray-400 dark:hover:bg-white/[0.03]",
            className,
          )}
          aria-label="用户菜单"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <Avatar size="sm" shape="circle">
            <AvatarFallback name={label} className="text-theme-xs font-semibold" />
          </Avatar>
          <span className="hidden max-w-[120px] truncate font-medium text-theme-sm sm:block">
            {label}
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-gray-500 transition-transform duration-200 dark:text-gray-400",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[260px] rounded-2xl border-gray-200 p-3 shadow-theme-lg dark:border-gray-800"
      >
        <div className="flex items-start gap-3">
          <Avatar size="md" shape="circle">
            <AvatarFallback name={label} />
          </Avatar>
          <div className="min-w-0 flex-1">
            <span className="block truncate font-medium text-theme-sm text-gray-800 dark:text-white/90">
              {label}
            </span>
            <span className="mt-0.5 block truncate text-theme-xs text-gray-500 dark:text-gray-400">
              {user.email}
            </span>
            <Badge variant="light" color="primary" className="mt-2">
              {roleLabel}
            </Badge>
          </div>
        </div>

        <ul className="flex flex-col gap-1 border-b border-gray-200 pt-4 pb-3 dark:border-gray-800">
          {canReturnToWorkspace ? (
            <li>
              <DropdownMenuItem
                onSelect={() => {
                  returnToWorkspace();
                  setOpen(false);
                }}
                className="gap-3 px-3 py-2 font-medium text-gray-700 dark:text-gray-400"
              >
                <ArrowLeft className="size-5" aria-hidden />
                返回工作台
              </DropdownMenuItem>
            </li>
          ) : null}

          <li>
            <DropdownMenuItem asChild>
              <Link
                to={ACCOUNT_CENTER_PATH}
                className="gap-3 px-3 py-2 font-medium text-gray-700 dark:text-gray-400"
                onClick={() => {
                  beginAccountManagement();
                  setOpen(false);
                }}
              >
                <User className="size-5" aria-hidden />
                个人中心
              </Link>
            </DropdownMenuItem>
          </li>

          {canOpenSystemAdmin ? (
            <li>
              <DropdownMenuItem asChild>
                <Link
                  to={SYSTEM_ADMIN_HOME_PATH}
                  className="gap-3 px-3 py-2 font-medium text-gray-700 dark:text-gray-400"
                  onClick={() => {
                    beginSystemAdmin();
                    setOpen(false);
                  }}
                >
                  <Settings className="size-5" aria-hidden />
                  后台管理
                </Link>
              </DropdownMenuItem>
            </li>
          ) : null}
        </ul>

        <DropdownMenuSeparator className="my-0" />

        <DropdownMenuItem
          onSelect={() => {
            logout();
            setOpen(false);
          }}
          className="group mt-1 flex cursor-pointer items-center gap-3 px-3 py-2 font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
        >
          <LogOut
            className="size-5 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300"
            aria-hidden
          />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
