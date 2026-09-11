import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { AccountSecurityOverview } from "./components/AccountSecurityOverview";
import { ChangePasswordSection } from "./components/ChangePasswordSection";

export function AccountSecurityPage() {
  return (
    <AdminPageShell
      title="安全设置"
      description="查看当前会话信息，并管理登录密码。"
    >
      <div className="grid w-full gap-6">
        <AccountSecurityOverview />
        <ChangePasswordSection />
      </div>
    </AdminPageShell>
  );
}
