import { useQuery } from "@tanstack/react-query";
import { Shield, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { primaryRoleLabel, type SessionRole } from "@/lib/session";
import type { MeProfile } from "../account-types";

function roleBadges(profile: MeProfile) {
  const roles = profile.roles as SessionRole[];
  const labels = roles.length > 0 ? roles : (["viewer"] as SessionRole[]);
  return labels.map((role) => (
    <Badge key={role} variant="light" color="info" size="sm">
      {primaryRoleLabel([role])}
    </Badge>
  ));
}

export function AccountSecurityOverview() {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiFetch<MeProfile>("/api/v1/me"),
  });

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-title-sm">
            <User className="size-4" aria-hidden />
            当前会话
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : isError || !data ? (
            <p className="text-theme-sm text-gray-600 dark:text-gray-400">无法加载账户信息</p>
          ) : (
            <dl className="grid gap-3">
              <div>
                <dt className="text-theme-xs text-gray-500 dark:text-gray-400">登录账号</dt>
                <dd className="mt-0.5 text-theme-sm font-medium text-gray-800 dark:text-white/90">
                  {data.username}
                </dd>
              </div>
              <div>
                <dt className="text-theme-xs text-gray-500 dark:text-gray-400">显示名称</dt>
                <dd className="mt-0.5 text-theme-sm font-medium text-gray-800 dark:text-white/90">
                  {data.displayName}
                </dd>
              </div>
              <div>
                <dt className="text-theme-xs text-gray-500 dark:text-gray-400">平台角色</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {roleBadges(data)}
                  {data.isRoot ? (
                    <Badge variant="light" color="warning" size="sm">
                      超级管理员
                    </Badge>
                  ) : null}
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-title-sm">
            <Shield className="size-4" aria-hidden />
            安全建议
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-theme-sm text-gray-600 dark:text-gray-400">
            <li>定期更换登录密码，避免与其他系统共用同一密码。</li>
            <li>离开工位时请退出登录，尤其在共享设备上。</li>
            <li>发现异常登录或权限变更，请及时联系平台管理员。</li>
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
