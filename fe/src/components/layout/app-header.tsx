import * as React from "react";
import { Link } from "react-router";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_HEADER_HEIGHT_CLASS } from "@/lib/adminLayoutTokens";
import { useSidebar } from "@/context/sidebar-context";

export type AppHeaderVariant = "default" | "transparent" | "elevated-on-scroll";

export type AppHeaderProps = {
  logo?: React.ReactNode;
  /** 顶栏中部或右侧扩展区；默认不渲染 */
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  variant?: AppHeaderVariant;
  className?: string;
};

export function AppHeader({
  logo,
  leading,
  actions,
  variant = "default",
  className,
}: AppHeaderProps) {
  const { isMobileOpen, isDrawerMode, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const [elevated, setElevated] = React.useState(false);

  React.useEffect(() => {
    if (variant !== "elevated-on-scroll") {
      setElevated(false);
      return;
    }

    const handleScroll = () => {
      setElevated(window.scrollY > 0);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [variant]);

  const handleToggle = () => {
    if (isDrawerMode) {
      toggleMobileSidebar();
      return;
    }
    toggleSidebar();
  };

  /** 抽屉已展开时左侧由侧栏承接，避免顶栏 X/Logo 与侧栏叠闪 */
  const hideLeftChrome = isDrawerMode && isMobileOpen;

  return (
    <header
      className={cn(
        "sticky top-0 z-99999 flex w-full shrink-0 items-center border-b border-gray-200 dark:border-gray-800",
        ADMIN_HEADER_HEIGHT_CLASS,
        variant === "transparent" ? "bg-transparent" : "bg-white dark:bg-gray-900",
        variant === "elevated-on-scroll" && elevated && "shadow-theme-sm",
        className,
      )}
      data-variant={variant}
      data-elevated={variant === "elevated-on-scroll" && elevated ? "true" : undefined}
    >
      <div className="flex h-full w-full items-center justify-between gap-3 px-4 sm:gap-4 xl:px-6">
        <div
          className={cn(
            "flex min-w-0 items-center gap-3",
            hideLeftChrome && "pointer-events-none invisible",
          )}
        >
          <button
            type="button"
            onClick={handleToggle}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors lg:size-11",
              "hover:bg-gray-50 hover:text-gray-700 focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20",
              "dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200",
              isMobileOpen && !isDrawerMode && "bg-gray-100 text-gray-700 dark:bg-white/[0.03] dark:text-gray-200",
            )}
            aria-label={isMobileOpen ? "关闭菜单" : "打开菜单"}
            aria-hidden={hideLeftChrome}
            tabIndex={hideLeftChrome ? -1 : undefined}
          >
            {isMobileOpen && !isDrawerMode ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Menu className="size-5" aria-hidden />
            )}
          </button>

          {logo ? (
            <Link
              to="/"
              className="shrink-0 xl:hidden"
              aria-label="返回首页"
              aria-hidden={hideLeftChrome}
              tabIndex={hideLeftChrome ? -1 : undefined}
            >
              {logo}
            </Link>
          ) : null}

          {leading ? <div className="hidden min-w-0 xl:block">{leading}</div> : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">{actions}</div>
      </div>
    </header>
  );
}
