import { useMemo } from "react";
import { Outlet, useLocation, useMatch } from "react-router";
import { cn } from "@/lib/utils";
import { useAdminFillScrollLock } from "@/hooks/useAdminFillScrollLock";
import { ThemeProvider } from "@/context/theme-context";
import { SidebarProvider, useSidebar } from "@/context/sidebar-context";
import { WorkspaceProvider } from "@/context/workspace-context";
import { AccountSidebarBack } from "@/components/layout/account-sidebar-back";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AdminNavPerfTracker } from "@/components/layout/AdminNavPerfTracker";
import { AppHeader } from "@/components/layout/app-header";
import { Backdrop } from "@/components/layout/backdrop";
import { ThemeToggleButton } from "@/components/layout/theme-toggle";
import { UserDropdown } from "@/components/layout/user-dropdown";
import { VitalSpanLogo } from "@/components/layout/vitalspan-logo";
import { isGovNavEnabledFromEnv } from "@/lib/gov-nav";
import { resolveSidebarSections } from "@/lib/resolve-nav";
import { sessionUserFromMe } from "@/lib/session";
import { isDetachedFromWorkspacePath } from "@/lib/workspace";
import { isAdminListFillRoute, isAdminScreenPreviewRoute, isAdminShareRoute, isAdminDatasetFormRoute, isAdminDatasourceFormRoute, isAdminDatasourceDetailRoute, isAdminSyncJobFormRoute, isAdminVizComponentEditRoute } from "@/lib/admin-layout-routes";
import {
  ADMIN_CONTENT_MARGIN_COLLAPSED_CLASS,
  ADMIN_CONTENT_MARGIN_EXPANDED_CLASS,
} from "@/lib/adminLayoutTokens";
import { useAuth } from "@/context/auth-context";
import { RouteErrorBoundary } from "@/components/ui/route-error-boundary";

function AdminLayoutContent() {
  const { isExpanded, isHovered, isMobileOpen, isDrawerMode } = useSidebar();
  const location = useLocation();
  const { user: authUser } = useAuth();
  const sessionUser = authUser
    ? sessionUserFromMe(authUser)
    : sessionUserFromMe({ username: "用户", roles: ["viewer"], permissions: [], isRoot: false });
  const isDetachedArea = isDetachedFromWorkspacePath(location.pathname);
  const navSections = useMemo(
    () =>
      resolveSidebarSections(sessionUser, location.pathname, {
        govNavEnabled: isGovNavEnabledFromEnv(),
      }),
    [sessionUser, location.pathname],
  );
  const dashboardEditMatch = useMatch("/admin/dashboards/:id/edit");
  const dashboardDetailMatch = useMatch("/admin/dashboards/:id");
  const dataScreenEditMatch = useMatch("/admin/data-screens/:id/edit");
  const dataScreenDetailMatch = useMatch("/admin/data-screens/:id");
  const isDashboardEditFill = Boolean(
    dashboardEditMatch || dashboardDetailMatch || dataScreenEditMatch || dataScreenDetailMatch,
  );
  const isListFillRoute = isAdminListFillRoute(location.pathname);
  const isShareRoute = isAdminShareRoute(location.pathname);
  const isScreenPreviewRoute = isAdminScreenPreviewRoute(location.pathname);
  const isVizComponentEditFill = isAdminVizComponentEditRoute(location.pathname);
  const isDatasetFormFill = isAdminDatasetFormRoute(location.pathname);
  const isDatasourceFormFill = isAdminDatasourceFormRoute(location.pathname);
  const isDatasourceDetailFill = isAdminDatasourceDetailRoute(location.pathname);
  const isSyncJobFormFill = isAdminSyncJobFormRoute(location.pathname);
  const isFillHeightRoute =
    isDashboardEditFill || isListFillRoute || isVizComponentEditFill || isDatasetFormFill || isDatasourceFormFill || isDatasourceDetailFill || isSyncJobFormFill || isShareRoute;
  // 所有标准管理页锁住 html/body，仅 main 滚动，避免细/粗双滚动条并存
  useAdminFillScrollLock(!isScreenPreviewRoute);

  if (isScreenPreviewRoute) {
    return (
      <div className="h-dvh max-h-dvh min-h-0 overflow-hidden" data-admin-layout="screen-preview">
        <RouteErrorBoundary>
          <Outlet />
        </RouteErrorBoundary>
      </div>
    );
  }

  return (
    <div
      className="flex h-dvh max-h-dvh min-h-0 overflow-hidden"
      data-admin-layout={isFillHeightRoute ? "fill" : "default"}
    >
      <AdminNavPerfTracker />
      <AppSidebar
        sections={navSections}
        logo={<VitalSpanLogo />}
        collapsedLogo={<VitalSpanLogo variant="icon" />}
        leading={isDetachedArea ? <AccountSidebarBack /> : undefined}
        navAriaLabel={
          isDetachedArea
            ? location.pathname.startsWith("/admin/account/")
              ? "账号导航"
              : "后台管理导航"
            : "管理端导航"
        }
      />
      <Backdrop />
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden transition-[margin] duration-300 ease-in-out",
          !isDrawerMode &&
            (isExpanded || isHovered
              ? ADMIN_CONTENT_MARGIN_EXPANDED_CLASS
              : ADMIN_CONTENT_MARGIN_COLLAPSED_CLASS),
        )}
      >
        <AppHeader
          className="shrink-0"
          logo={<VitalSpanLogo linked={false} />}
          actions={
            <>
              <ThemeToggleButton />
              <UserDropdown />
            </>
          }
        />
        <main
          className={cn(
            "mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col",
            isFillHeightRoute
              ? "overflow-hidden p-1.5 md:p-2 [&>*]:min-h-0 [&>*]:flex-1"
              : "custom-scrollbar overflow-y-auto p-4 pb-20 md:p-6 md:pb-24 [&>*]:shrink-0",
          )}
        >
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export function AdminLayout() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <WorkspaceProvider>
          <AdminLayoutContent />
        </WorkspaceProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
