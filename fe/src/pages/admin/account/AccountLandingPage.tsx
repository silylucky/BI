import { useQuery } from "@tanstack/react-query";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { MeProfile } from "./account-types";
import { RoleDefaultViewCard } from "./components/RoleDefaultViewCard";
import { UserViewsSection } from "./components/UserViewsSection";

export function AccountLandingPage() {
  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiFetch<MeProfile>("/api/v1/me"),
  });

  return (
    <AdminPageShell
      title="登录入口"
      description="配置登录后优先进入的个人视图，或查看角色默认看板。"
    >
      <div className="grid w-full gap-6">
        {meQuery.isLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : meQuery.data ? (
          <RoleDefaultViewCard roles={meQuery.data.roles} />
        ) : null}
        <UserViewsSection />
      </div>
    </AdminPageShell>
  );
}
