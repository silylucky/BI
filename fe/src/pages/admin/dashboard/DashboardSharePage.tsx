import { useNavigate, useLocation, useParams } from "react-router";
import { DashboardShareDialog } from "@/components/dashboard/DashboardShareDialog";
import {
  dataScreenEditPath,
  isDataScreenAdminPath,
} from "@/lib/dataScreenLayout";

/** 分享路由：仅渲染弹窗，关闭后回到编辑页 */
export function DashboardSharePage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isScreen = isDataScreenAdminPath(location.pathname);

  if (!id) {
    void navigate(isScreen ? "/admin/data-screens" : "/admin/dashboards", { replace: true });
    return null;
  }

  const editPath = isScreen ? dataScreenEditPath(id) : `/admin/dashboards/${id}/edit`;

  return (
    <DashboardShareDialog
      open
      dashboardId={id}
      isScreen={isScreen}
      onOpenChange={(open) => {
        if (!open) void navigate(editPath, { replace: true });
      }}
    />
  );
}
