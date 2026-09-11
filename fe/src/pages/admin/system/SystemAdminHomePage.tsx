import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, CheckCircle2, Circle, Link2, Shield, Users } from "lucide-react";
import { Link } from "react-router";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { Button } from "@/components/ui/button";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { SystemAdminPermissionGuide } from "./SystemAdminScopeHint";
type SetupStep = {
  id: string;
  title: string;
  summary: string;
  href: string;
  done: boolean;
  stepLabel: string;
};

function StepCard({ step }: { step: SetupStep }) {  const Icon = step.done ? CheckCircle2 : Circle;
  return (
    <Link
      to={step.href}
      className={cn(
        "group flex items-start gap-4 rounded-2xl border p-5 transition-colors",
        step.done
          ? "border-success-200 bg-success-50/50 dark:border-success-500/20 dark:bg-success-500/5"
          : "border-gray-200 bg-white hover:border-brand-200 hover:bg-brand-50/30 dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-brand-500/30",
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          step.done
            ? "bg-success-100 text-success-600 dark:bg-success-500/15 dark:text-success-400"
            : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">{step.stepLabel}</p>        <h2 className="mt-0.5 text-theme-sm font-semibold text-gray-800 dark:text-white/90">
          {step.title}
        </h2>
        <p className="mt-1 text-theme-sm text-gray-600 dark:text-gray-400">{step.summary}</p>
        <p className="mt-2 text-theme-xs font-medium text-brand-600 group-hover:underline dark:text-brand-400">
          {step.done ? "查看或调整" : "去配置"}
          <ArrowRight className="ml-1 inline size-3.5" aria-hidden />
        </p>
      </div>
    </Link>
  );
}

export function SystemAdminHomePage() {
  const { user: authUser } = useAuth();
  const orgsQuery = useQuery({
    queryKey: queryKeys.orgs.list({ limit: 1, offset: 0 }),
    queryFn: () =>
      apiFetch<{ items: unknown[]; total: number }>("/api/v1/orgs?limit=1&offset=0"),
  });
  const usersQuery = useQuery({
    queryKey: queryKeys.users.list({ limit: 500, offset: 0 }),
    queryFn: () =>
      apiFetch<{ items: { id: string }[]; total: number }>("/api/v1/users?limit=500&offset=0"),
  });
  const rolesQuery = useQuery({
    queryKey: queryKeys.roles.list({ limit: 500, offset: 0 }),
    queryFn: () =>
      apiFetch<{ items: { isRoot?: boolean }[]; total: number }>(
        "/api/v1/roles?limit=500&offset=0",
      ),
  });
  const grantsQuery = useQuery({
    queryKey: queryKeys.resourceGrants.list({}),
    queryFn: () => apiFetch<{ items: unknown[] }>("/api/v1/resource-grants"),
  });
  const emailConnectQuery = useQuery({
    queryKey: queryKeys.platformConnect.emailSlots,
    queryFn: () =>
      apiFetch<{ items: { configured: boolean }[] }>("/api/v1/platform/delivery/email/slots"),
  });

  const loading =
    orgsQuery.isLoading ||
    usersQuery.isLoading ||
    rolesQuery.isLoading ||
    grantsQuery.isLoading;
  const emailConfigured = emailConnectQuery.data?.items?.some((item) => item.configured) ?? false;

  const hasError =
    orgsQuery.isError ||
    usersQuery.isError ||
    rolesQuery.isError ||
    grantsQuery.isError;

  const errorMessage =
    (orgsQuery.error && mapApiError(orgsQuery.error)) ||
    (usersQuery.error && mapApiError(usersQuery.error)) ||
    (rolesQuery.error && mapApiError(rolesQuery.error)) ||
    (grantsQuery.error && mapApiError(grantsQuery.error)) ||
    "加载配置进度失败";

  const retryAll = () => {
    void orgsQuery.refetch();
    void usersQuery.refetch();
    void rolesQuery.refetch();
    void grantsQuery.refetch();
  };

  const orgCount = orgsQuery.data?.total ?? 0;
  const userTotal = usersQuery.data?.total ?? 0;
  const businessUserCount = (usersQuery.data?.items ?? []).filter(
    (u) => u.id !== authUser?.id,
  ).length;
  const roles = rolesQuery.data?.items ?? [];
  const businessRoleCount = roles.filter((r) => !r.isRoot).length;
  const grantCount = grantsQuery.data?.items.length ?? 0;

  const requiredSteps: SetupStep[] = [
    {
      id: "orgs",
      stepLabel: "基础步骤 1",
      title: "建立组织架构",
      summary: "按处室、部门或辖区维护组织树，用户归属与组织维度数据范围都依赖于此。",
      href: "/admin/system/orgs",
      done: orgCount > 0,
    },
    {
      id: "roles",
      stepLabel: "基础步骤 2",
      title: "配置岗位角色",
      summary:
        "定义岗位并勾选侧栏菜单与功能权限（如能否管理数据源、编辑仪表板）。具体报表可见性在下一步资源授权中配置。",
      href: "/admin/system/roles",
      done: businessRoleCount > 0,
    },
    {
      id: "users",
      stepLabel: "基础步骤 3",
      title: "开通用户账号",
      summary: "创建业务人员账号，绑定岗位角色与所属组织，并交付初始密码。",
      href: "/admin/system/users",
      done: businessUserCount > 0,
    },
  ];

  const optionalSteps: SetupStep[] = [
    {
      id: "email",
      stepLabel: "可选步骤 1",
      title: "配置邮件发信",
      summary: "在平台对接中保存 SMTP，供定时报告发到用户邮箱。当前仅支持邮件通道。",
      href: "/admin/system/platform-connect",
      done: emailConfigured,
    },
    {
      id: "grants",
      stepLabel: "可选步骤 2",
      title: "分配可访问资源",
      summary: "指定各角色可查看的仪表板、报表或数据源。角色权限已覆盖时可跳过。",
      href: "/admin/system/grants",
      done: grantCount > 0,
    },
  ];

  const requiredDone = requiredSteps.every((s) => s.done);
  const requiredCompleted = requiredSteps.filter((s) => s.done).length;
  const optionalCompleted = optionalSteps.filter((s) => s.done).length;
  const nextStep =
    requiredSteps.find((s) => !s.done) ?? optionalSteps.find((s) => !s.done) ?? requiredSteps[0];
  return (
    <AdminPageShell
      title="后台管理"
      description="先完成组织 → 角色 → 用户三步基础配置，再按需配置邮件、资源授权等增强能力。"    >
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          {hasError ? (
            <PageErrorBanner message={errorMessage} onRetry={retryAll} />
          ) : null}
          <SystemAdminPermissionGuide />
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">
                  首租户配置向导
                </h2>
                <p className="mt-1 text-theme-sm text-gray-600 dark:text-gray-400">
                  {loading
                    ? "正在检查当前配置进度…"
                    : requiredDone
                      ? `基础配置已完成（${requiredCompleted}/${requiredSteps.length}）。可选增强 ${optionalCompleted}/${optionalSteps.length}。`
                      : `基础进度 ${requiredCompleted}/${requiredSteps.length}，请继续未完成的基础步骤。`}
                </p>
              </div>
              {!loading && !requiredDone ? (
                <Button type="button" variant="primary" size="sm" asChild>
                  <Link to={nextStep.href}>继续配置</Link>
                </Button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="grid gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <section className="space-y-3">
                <h3 className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  基础配置（必做）
                </h3>
                <div className="grid gap-3">
                  {requiredSteps.map((step) => (
                    <StepCard key={step.id} step={step} />
                  ))}
                </div>
              </section>
              <section className="space-y-3">
                <h3 className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  增强配置（可选）
                </h3>
                <div className="grid gap-3">
                  {optionalSteps.map((step) => (
                    <StepCard key={step.id} step={step} />
                  ))}
                </div>
              </section>
            </div>
          )}        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center gap-2 text-theme-sm font-semibold text-gray-800 dark:text-white/90">
              <Building2 className="size-4 text-gray-500" aria-hidden />
              快捷入口
            </div>
            <ul className="mt-3 space-y-2 text-theme-sm">
              <li>
                <Link className="text-brand-600 hover:underline dark:text-brand-400" to="/admin/system/orgs">
                  组织架构
                </Link>
              </li>
              <li>
                <Link className="text-brand-600 hover:underline dark:text-brand-400" to="/admin/system/roles">
                  角色管理
                </Link>
              </li>
              <li>
                <Link className="text-brand-600 hover:underline dark:text-brand-400" to="/admin/system/users">
                  用户管理
                </Link>
              </li>
              <li>
                <Link className="text-brand-600 hover:underline dark:text-brand-400" to="/admin/system/grants">
                  资源授权
                </Link>
              </li>
              <li>
                <Link className="text-brand-600 hover:underline dark:text-brand-400" to="/admin/system/platform-connect">
                  平台对接
                </Link>
              </li>
              <li>
                <Link className="text-brand-600 hover:underline dark:text-brand-400" to="/admin/system/audit">
                  审计日志
                </Link>
              </li>
            </ul>          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-500/25 dark:bg-amber-500/10">
            <div className="flex items-center gap-2 text-theme-sm font-semibold text-gray-800 dark:text-white/90">
              <Shield className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
              高级：行级权限
            </div>
            <p className="mt-2 text-theme-xs leading-relaxed text-gray-600 dark:text-gray-400">
              需要按组织或自定义维度过滤查询结果时再配置。日常「谁能看哪些报表」通常用角色 + 资源授权即可。
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-3 w-full" asChild>
              <Link to="/admin/system/rls">打开行级权限</Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-5 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2 text-theme-sm font-semibold text-gray-800 dark:text-white/90">
              <Link2 className="size-4 text-gray-500" aria-hidden />
              平台对接说明
            </div>
            <p className="mt-2 text-theme-xs leading-relaxed text-gray-600 dark:text-gray-400">
              当前支持邮件 SMTP、飞书工作通知与钉钉群机器人，入口均在本页「平台对接」。
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-5 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2 text-theme-sm font-semibold text-gray-800 dark:text-white/90">
              <Users className="size-4 text-gray-500" aria-hidden />              当前概览
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-theme-sm">
              <div>
                <dt className="text-gray-500 dark:text-gray-400">组织节点</dt>
                <dd className="font-semibold text-gray-800 dark:text-white/90">
                  {loading ? "—" : orgCount}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">用户</dt>
                <dd className="font-semibold text-gray-800 dark:text-white/90">
                  {loading ? "—" : userTotal}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">角色</dt>
                <dd className="font-semibold text-gray-800 dark:text-white/90">
                  {loading ? "—" : roles.length}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">资源授权</dt>
                <dd className="font-semibold text-gray-800 dark:text-white/90">
                  {loading ? "—" : grantCount}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </AdminPageShell>
  );
}
