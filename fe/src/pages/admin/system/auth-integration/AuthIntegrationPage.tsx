import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

type IntegrationStatus = {
  ldapEnabled: boolean;
  oidcEnabled: boolean;
  specReady: boolean;
};

export function AuthIntegrationPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["auth-integration", "status"],
    queryFn: () => apiFetch<IntegrationStatus>("/api/v1/auth-integration/status"),
  });

  return (
    <AdminPageShell
      layout="list"
      title="认证集成"
      description="LDAP / OIDC 外部身份源配置（规格门禁后开放完整能力）。"
    >
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex items-start gap-4">
          <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
            <ShieldCheck className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-theme-sm text-gray-600 dark:text-gray-400">
              当前为 Phase C 骨架：规格文档、管理入口与 OIDC 回调占位已就绪；完整 LDAP/OIDC 联调须通过
              spec gate 后实施。
            </p>
            {isLoading ? (
              <Skeleton className="h-8 w-48" />
            ) : (
              <div className="flex flex-wrap gap-2">
                <Badge variant="light" color={data?.ldapEnabled ? "success" : "light"} size="sm">
                  LDAP {data?.ldapEnabled ? "已启用" : "未启用"}
                </Badge>
                <Badge variant="light" color={data?.oidcEnabled ? "success" : "light"} size="sm">
                  OIDC {data?.oidcEnabled ? "已启用" : "未启用"}
                </Badge>
                <Badge variant="light" color={data?.specReady ? "primary" : "warning"} size="sm">
                  规格 {data?.specReady ? "已登记" : "待补充"}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminPageShell>
  );
}
