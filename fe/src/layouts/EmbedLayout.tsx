import { Outlet } from "react-router";
import { RouteErrorBoundary } from "@/components/ui/route-error-boundary";

export function EmbedLayout() {
  return (
    <div className="min-h-screen w-full bg-gray-50 dark:bg-gray-950">
      <RouteErrorBoundary>
        <Outlet />
      </RouteErrorBoundary>
    </div>
  );
}
