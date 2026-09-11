import { LayoutGrid } from "lucide-react";
import { AdminPageHeaderIcon, AdminPageShell } from "@/components/layout/admin-page-shell";
import { ChartExploreContent } from "@/components/dashboard/ChartExploreContent";

export function ChartTypesCatalogPage() {
  return (
    <AdminPageShell
      layout="fill"
      title="图表类型目录"
      description="浏览平台已注册的图表类型、渲染器与字段绑定规则（VIZ-003）。"
      icon={
        <AdminPageHeaderIcon>
          <LayoutGrid aria-hidden />
        </AdminPageHeaderIcon>
      }
    >
      <ChartExploreContent />
    </AdminPageShell>
  );
}
