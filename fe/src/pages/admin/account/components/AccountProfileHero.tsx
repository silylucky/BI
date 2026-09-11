import { Pencil } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { primaryRoleLabel, type SessionRole } from "@/lib/session";
import type { MeProfile } from "../account-types";

type AccountProfileHeroProps = {
  profile: MeProfile;
  onEdit: () => void;
};

export function AccountProfileHero({ profile, onEdit }: AccountProfileHeroProps) {
  const roleLabel = primaryRoleLabel(profile.roles as SessionRole[]);
  const label = profile.displayName || profile.username;
  const shortId = profile.id.length > 8 ? profile.id.slice(0, 8) : profile.id;

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar size="xl" shape="circle">
            <AvatarFallback name={label} className="text-theme-lg font-semibold" />
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-title-xs font-semibold text-gray-900 dark:text-white">
                {label}
              </h2>
              {profile.isRoot ? (
                <Badge variant="light" color="warning" size="sm">
                  超级管理员
                </Badge>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label="编辑基本资料"
                onClick={onEdit}
              >
                <Pencil className="size-4" aria-hidden />
              </Button>
            </div>
            <p className="mt-1 text-theme-sm text-brand-600 dark:text-brand-400">{roleLabel}</p>
            <p className="mt-0.5 truncate text-theme-xs text-gray-500 dark:text-gray-400">
              {profile.email}
            </p>
          </div>
        </div>

        <dl className="grid shrink-0 grid-cols-3 divide-x divide-gray-200 rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          <div className="px-5 py-3 text-center">
            <dt className="text-theme-xs text-gray-500 dark:text-gray-400">用户 ID</dt>
            <dd className="mt-1 font-mono text-theme-sm font-medium text-gray-800 dark:text-white/90">
              {shortId}
            </dd>
          </div>
          <div className="px-5 py-3 text-center">
            <dt className="text-theme-xs text-gray-500 dark:text-gray-400">会话状态</dt>
            <dd className="mt-1">
              <Badge variant="light" color="success" size="sm">
                已登录
              </Badge>
            </dd>
          </div>
          <div className="px-5 py-3 text-center">
            <dt className="text-theme-xs text-gray-500 dark:text-gray-400">平台角色</dt>
            <dd className="mt-1 text-theme-sm font-medium text-gray-800 dark:text-white/90">
              {roleLabel}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
