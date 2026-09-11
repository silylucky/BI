import { ArrowLeft } from "lucide-react";
import { useSidebar } from "@/context/sidebar-context";
import { useWorkspace } from "@/context/workspace-context";
import { cn } from "@/lib/utils";

export function AccountSidebarBack() {
  const { returnToWorkspace } = useWorkspace();
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const showLabels = isExpanded || isHovered || isMobileOpen;

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={returnToWorkspace}
        className={cn(
          "group menu-item w-full menu-item-inactive",
          !showLabels && "xl:justify-center",
        )}
        aria-label="返回工作台"
      >
        <span className="menu-item-icon-size menu-item-icon-inactive">
          <ArrowLeft className="size-5" aria-hidden />
        </span>
        {showLabels ? <span className="menu-item-text">返回工作台</span> : null}
      </button>
    </div>
  );
}
