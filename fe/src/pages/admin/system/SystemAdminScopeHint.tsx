import type { ReactNode } from "react";
import { Link } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export type SystemAdminScope =
  | "orgs"
  | "users"
  | "roles"
  | "grants"
  | "rls"
  | "platform-connect";

const LINK_CLASS = "text-brand-600 underline dark:text-brand-400";

type HintConfig = {
  severity?: "info" | "warning";
  title?: string;
  body: ReactNode;
  testId?: string;
};

const HINTS: Record<SystemAdminScope, HintConfig> = {
  orgs: {
    body: (
      <>
        组织树用于用户归属与
        <Link to="/admin/system/rls" className={`mx-1 ${LINK_CLASS}`}>
          行级权限
        </Link>
        中的组织维度。「谁能看哪张报表」请在
        <Link to="/admin/system/grants" className={`mx-1 ${LINK_CLASS}`}>
          资源授权
        </Link>
        配置。
      </>
    ),
  },
  users: {
    body: (
      <>
        在此创建账号并绑定
        <Link to="/admin/system/roles" className={`mx-1 ${LINK_CLASS}`}>
          角色
        </Link>
        （功能权限）与组织（数据范围）。侧栏可见菜单由角色决定，具体报表可见性见
        <Link to="/admin/system/grants" className={`mx-1 ${LINK_CLASS}`}>
          资源授权
        </Link>
        。
      </>
    ),
  },
  roles: {
    body: (
      <>
        本页控制<strong className="font-medium">侧栏菜单与功能能力</strong>
        （如能否编辑仪表板、管理数据源）。能看见哪张具体报表请在
        <Link to="/admin/system/grants" className={`mx-1 ${LINK_CLASS}`}>
          资源授权
        </Link>
        配置；查询行级过滤请在
        <Link to="/admin/system/rls" className={`mx-1 ${LINK_CLASS}`}>
          行级权限
        </Link>
        配置。
      </>
    ),
  },
  grants: {
    body: (
      <>
        本页指定角色能<strong className="font-medium">看见哪些</strong>
        仪表板、报表或数据源。侧栏入口与编辑能力请在
        <Link to="/admin/system/roles" className={`mx-1 ${LINK_CLASS}`}>
          角色管理
        </Link>
        配置；查询结果按组织/维度过滤请在
        <Link to="/admin/system/rls" className={`mx-1 ${LINK_CLASS}`}>
          行级权限
        </Link>
        配置。
      </>
    ),
  },
  rls: {
    severity: "warning",
    body: (
      <>
        日常「谁能看哪些报表」请优先使用
        <Link to="/admin/system/roles" className={`mx-1 ${LINK_CLASS}`}>
          角色权限
        </Link>
        与
        <Link to="/admin/system/grants" className={`mx-1 ${LINK_CLASS}`}>
          资源授权
        </Link>
        ；仅在有进阶数据范围需求时配置本页。也可返回
        <Link to="/admin/system" className={`mx-1 ${LINK_CLASS}`}>
          配置向导
        </Link>
        完成基础设置。
      </>
    ),
  },
  "platform-connect": {
    severity: "info",
    title: "当前能力范围",
    testId: "platform-connect-scope-hint",
    body: (
      <>
        本页配置邮件 SMTP（QQ / 163 等槽位），供定时报告等场景发信。收件人只需填写邮箱地址，无需绑定飞书、钉钉或企业微信。
      </>
    ),
  },
};

export function SystemAdminScopeHint({ scope }: { scope: SystemAdminScope }) {
  const hint = HINTS[scope];
  return (
    <Alert
      severity={hint.severity ?? "info"}
      appearance="subtle"
      className="rounded-lg py-3"
      data-testid={hint.testId}
    >
      {hint.title ? <AlertTitle>{hint.title}</AlertTitle> : null}
      <AlertDescription className="text-theme-sm leading-relaxed text-gray-600 dark:text-gray-400">
        {hint.body}
      </AlertDescription>
    </Alert>
  );
}

export function SystemAdminPermissionGuide() {
  return (
    <div className="rounded-2xl border border-brand-200/80 bg-brand-50/40 p-5 dark:border-brand-500/20 dark:bg-brand-500/5">
      <h2 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">权限怎么配？</h2>
      <dl className="mt-3 space-y-2.5 text-theme-sm text-gray-600 dark:text-gray-400">
        <div>
          <dt className="font-medium text-gray-800 dark:text-white/90">角色管理</dt>
          <dd>控制侧栏菜单与功能能力（能否建数据源、改仪表板等）。</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-800 dark:text-white/90">资源授权</dt>
          <dd>控制能看见哪些仪表板、报表、数据源。</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-800 dark:text-white/90">行级权限</dt>
          <dd>控制查询结果按组织或自定义维度过滤（进阶，多数场景可后配）。</dd>
        </div>
      </dl>
    </div>
  );
}
