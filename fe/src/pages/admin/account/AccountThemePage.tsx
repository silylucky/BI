import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { ThemePreferencesSection } from "./components/ThemePreferencesSection";

export function AccountThemePage() {
  return (
    <AdminPageShell
      title="界面主题"
      description="配置浅色、深色或跟随系统的界面外观。"
    >
      <ThemePreferencesSection />
    </AdminPageShell>
  );
}
