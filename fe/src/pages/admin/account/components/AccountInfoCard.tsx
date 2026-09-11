import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { primaryRoleLabel, type SessionRole } from "@/lib/session";
import type { MeProfile } from "../account-types";

type InfoRow = { label: string; value: ReactNode };

function InfoGrid({ rows }: { rows: InfoRow[] }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]"
        >
          <dt className="text-theme-xs text-gray-500 dark:text-gray-400">{row.label}</dt>
          <dd className="mt-1 text-theme-sm font-medium text-gray-800 dark:text-white/90">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function RoleBadges({ roles, isRoot }: { roles: string[]; isRoot?: boolean }) {
  const sessionRoles = (roles.length > 0 ? roles : ["viewer"]) as SessionRole[];
  return (
    <div className="flex flex-wrap gap-1.5">
      {sessionRoles.map((role) => (
        <Badge key={role} variant="light" color="info" size="sm">
          {primaryRoleLabel([role])}
        </Badge>
      ))}
      {isRoot ? (
        <Badge variant="light" color="warning" size="sm">
          超级管理员
        </Badge>
      ) : null}
    </div>
  );
}

type AccountInfoCardProps = {
  profile: MeProfile;
  onEditEmail?: () => void;
};

export function AccountInfoCard({ profile, onEditEmail }: AccountInfoCardProps) {
  const permissionCount = profile.permissions?.length ?? 0;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <header className="mb-5">
        <h2 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">账户信息</h2>
        <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
          当前登录账户的基础资料与权限标识
        </p>
      </header>
      <InfoGrid
        rows={[
          { label: "用户 ID", value: <span className="font-mono text-theme-xs">{profile.id}</span> },
          { label: "显示名称", value: profile.displayName },
          { label: "登录账号", value: profile.username },
          {
            label: "平台角色",
            value: <RoleBadges roles={profile.roles} isRoot={profile.isRoot} />,
          },
          {
            label: "电子邮箱",
            value: (
              <span className="inline-flex items-center gap-2">
                <span>{profile.email}</span>
                {onEditEmail ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    aria-label="修改电子邮箱"
                    onClick={onEditEmail}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </Button>
                ) : null}
              </span>
            ),
          },
          {
            label: "权限范围",
            value: profile.isRoot ? (
              <Badge variant="light" color="success" size="sm">
                全部权限
              </Badge>
            ) : permissionCount > 0 ? (
              <span>{permissionCount} 项已授权</span>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">未分配权限</span>
            ),
          },
          {
            label: "会话状态",
            value: (
              <Badge variant="light" color="success" size="sm">
                已登录
              </Badge>
            ),
          },
        ]}
      />
    </section>
  );
}
