import * as React from "react";
import { flushSync } from "react-dom";
import { Link, useLocation } from "react-router";
import { ChevronDown } from "lucide-react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { isNavPathActive, resolveActiveNavPath } from "@/lib/nav-active";
import { cn } from "@/lib/utils";
import {
  ADMIN_CONTENT_MARGIN_COLLAPSED_CLASS,
  ADMIN_CONTENT_MARGIN_EXPANDED_CLASS,
  ADMIN_HEADER_HEIGHT_CLASS,
  ADMIN_SIDEBAR_COLLAPSED_CLASS,
  ADMIN_SIDEBAR_EXPANDED_CLASS,
} from "@/lib/adminLayoutTokens";
import { useSidebar } from "@/context/sidebar-context";
import { prefetchAdminRoute } from "@/lib/routePrefetch";
import { beginAdminNavTransition } from "@/lib/adminHeavyRenderSuspend";
import { isReportCenterNavGroup, resolveReportCenterSubNavPath } from "@/lib/reportCenterNav";

export type NavSubItem = {
  name: string;
  path: string;
  new?: boolean;
  pro?: boolean;
  target?: string;
};

export type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  new?: boolean;
  preview?: boolean;
  target?: string;
  subItems?: NavSubItem[];
  badgeLabel?: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
  /** 侧栏分组默认折叠（工程/系统） */
  defaultCollapsed?: boolean;
};

export type AppSidebarProps = {
  sections: NavSection[];
  logo?: React.ReactNode;
  collapsedLogo?: React.ReactNode;
  widget?: React.ReactNode;
  leading?: React.ReactNode;
  navAriaLabel?: string;
  className?: string;
};

function NavBadge({
  label,
  variant,
  active,
}: {
  label: string;
  variant: "new" | "pro" | "preview" | "governance";
  active?: boolean;
}) {
  if (variant === "governance") {
    return (
      <span className="ml-auto shrink-0 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
        {label}
      </span>
    );
  }

  let base: string;
  let state: string;

  if (variant === "pro") {
    base = "menu-dropdown-badge-pro";
    state = active
      ? "menu-dropdown-badge-pro-active"
      : "menu-dropdown-badge-pro-inactive";
  } else if (variant === "preview") {
    base = "menu-dropdown-badge-preview";
    state = active
      ? "menu-dropdown-badge-preview-active"
      : "menu-dropdown-badge-preview-inactive";
  } else {
    base = "menu-dropdown-badge";
    state = active
      ? "menu-dropdown-badge-active"
      : "menu-dropdown-badge-inactive";
  }

  return <span className={cn("ml-auto shrink-0", state, base)}>{label}</span>;
}

function useCollapsibleOpen(hasActiveChild: boolean, defaultOpen = false) {
  const [open, setOpen] = React.useState(defaultOpen || hasActiveChild);
  const isHoveringRef = React.useRef(false);

  React.useEffect(() => {
    if (hasActiveChild) {
      setOpen(true);
    }
  }, [hasActiveChild]);

  const hoverZoneProps = {
    onMouseEnter: () => {
      isHoveringRef.current = true;
      setOpen(true);
    },
    onMouseLeave: () => {
      isHoveringRef.current = false;
      if (!hasActiveChild) {
        setOpen(false);
      }
    },
  };

  const toggleFromClick = () => {
    if (!isHoveringRef.current) {
      setOpen((prev) => !prev);
    }
  };

  const toggleFromKeyboard = () => {
    setOpen((prev) => !prev);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && isHoveringRef.current) {
      return;
    }
    setOpen(next);
  };

  return {
    open,
    setOpen,
    handleOpenChange,
    hoverZoneProps,
    toggleFromClick,
    toggleFromKeyboard,
  };
}

function collectSectionPaths(section: NavSection): string[] {
  const paths: string[] = [];
  for (const item of section.items) {
    if (item.path) paths.push(item.path);
    for (const sub of item.subItems ?? []) {
      paths.push(sub.path);
    }
  }
  return paths;
}

function SidebarNavItem({
  item,
  showLabels,
  sectionPaths,
}: {
  item: NavItem;
  showLabels: boolean;
  sectionPaths: string[];
}) {
  const location = useLocation();
  const subPaths = item.subItems?.map((sub) => sub.path) ?? [];
  const reportNavGroup = isReportCenterNavGroup(item.subItems);
  const activeSubPath = subPaths.length
    ? reportNavGroup
      ? resolveReportCenterSubNavPath(location.pathname)
      : resolveActiveNavPath(location.pathname, subPaths)
    : null;
  const isActive = (path: string) => {
    if (subPaths.length > 0) {
      if (reportNavGroup) {
        return resolveReportCenterSubNavPath(location.pathname) === path;
      }
      return isNavPathActive(location.pathname, path, subPaths);
    }
    return isNavPathActive(location.pathname, path, sectionPaths);
  };
  const hasActiveChild = activeSubPath !== null;
  const { open, handleOpenChange, hoverZoneProps, toggleFromClick, toggleFromKeyboard } =
    useCollapsibleOpen(hasActiveChild);

  if (item.subItems?.length) {
    return (
      <Collapsible.Root open={open} onOpenChange={handleOpenChange}>
        <div {...hoverZoneProps}>
        <Collapsible.Trigger
          className={cn(
            "group menu-item w-full cursor-pointer",
            open || hasActiveChild ? "menu-item-active" : "menu-item-inactive",
            !showLabels && "md:justify-center",
          )}
          onClick={(event) => {
            event.preventDefault();
            toggleFromClick();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggleFromKeyboard();
            }
          }}
        >
          <span
            className={cn(
              "menu-item-icon-size",
              open || hasActiveChild
                ? "menu-item-icon-active"
                : "menu-item-icon-inactive",
            )}
          >
            {item.icon}
          </span>
          {showLabels && <span className="menu-item-text">{item.name}</span>}
          {item.new && showLabels ? (
            <NavBadge label="new" variant="new" active={open} />
          ) : null}
          {item.preview && showLabels ? (
            <NavBadge
              label="预览"
              variant="preview"
              active={open || hasActiveChild}
            />
          ) : null}
          {showLabels ? (
            <ChevronDown
              className={cn(
                "ml-auto size-4 shrink-0 text-gray-400 transition-transform duration-200",
                open && "rotate-180 text-brand-500 dark:text-brand-400",
              )}
              aria-hidden
            />
          ) : null}
        </Collapsible.Trigger>
        {showLabels ? (
          <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <ul className="relative mt-1 ml-[22px] space-y-0.5 border-l border-gray-200 pl-3 dark:border-gray-800">
              {item.subItems.map((subItem) => {
                const active = isActive(subItem.path);
                return (
                  <li key={subItem.path}>
                    <Link
                      to={subItem.path}
                      target={subItem.target}
                      onMouseEnter={() => prefetchAdminRoute(subItem.path)}
                      onFocus={() => prefetchAdminRoute(subItem.path)}
                      className={cn(
                        "menu-dropdown-item",
                        active
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive",
                      )}
                    >
                      <span className="truncate">{subItem.name}</span>
                      <span className="ml-auto flex shrink-0 items-center gap-1">
                        {subItem.new ? (
                          <NavBadge label="new" variant="new" active={active} />
                        ) : null}
                        {subItem.pro ? (
                          <NavBadge label="pro" variant="pro" active={active} />
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Collapsible.Content>
        ) : null}
        </div>
      </Collapsible.Root>
    );
  }

  if (!item.path) {
    return null;
  }

  const active = isActive(item.path);

  const link = (
    <Link
      to={item.path}
      target={item.target}
      onMouseEnter={() => prefetchAdminRoute(item.path)}
      onFocus={() => prefetchAdminRoute(item.path)}
      className={cn(
        "group menu-item",
        active ? "menu-item-active" : "menu-item-inactive",
        !showLabels && "md:justify-center",
      )}
    >
      <span
        className={cn(
          "menu-item-icon-size",
          active ? "menu-item-icon-active" : "menu-item-icon-inactive",
        )}
      >
        {item.icon}
      </span>
      {showLabels ? <span className="menu-item-text">{item.name}</span> : null}
      {item.badgeLabel && showLabels ? (
        <NavBadge label={item.badgeLabel} variant="governance" active={active} />
      ) : null}
      {item.preview && showLabels ? (
        <NavBadge label="预览" variant="preview" active={active} />
      ) : null}
    </Link>
  );

  if (item.badgeLabel) {
    return (
      <HintTooltip label="面向数据治理闭环；普通分析请使用仪表板。">
        {link}
      </HintTooltip>
    );
  }

  return link;
}

function handleSidebarNavPointerDownCapture(event: React.PointerEvent<HTMLElement>) {
  const target = event.target as Element | null;
  const link = target?.closest("a[href]");
  if (!link || link.getAttribute("target") === "_blank") return;
  flushSync(() => beginAdminNavTransition());
}

function SidebarSection({
  section,
  showLabels,
  showDivider,
}: {
  section: NavSection;
  showLabels: boolean;
  showDivider?: boolean;
}) {
  const location = useLocation();
  const sectionPaths = React.useMemo(() => collectSectionPaths(section), [section]);
  const hasActiveItem = section.items.some((item) => {
    if (item.subItems?.length) {
      const subPaths = item.subItems.map((sub) => sub.path);
      return resolveActiveNavPath(location.pathname, subPaths) !== null;
    }
    if (item.path) return isNavPathActive(location.pathname, item.path, sectionPaths);
    return false;
  });
  const { open, handleOpenChange, hoverZoneProps, toggleFromClick, toggleFromKeyboard } =
    useCollapsibleOpen(hasActiveItem, section.defaultCollapsed ? false : true);

  const body = (
    <ul className="flex flex-col gap-0.5">
      {section.items.map((item) => (
        <li key={item.name}>
          <SidebarNavItem item={item} showLabels={showLabels} sectionPaths={sectionPaths} />
        </li>
      ))}
    </ul>
  );

  if (!section.defaultCollapsed) {
    return (
      <div
        className={cn(
          "menu-group",
          showDivider && "border-t border-gray-100 pt-5 dark:border-white/[0.06]",
        )}
      >
        {showLabels ? (
          <h2 className="menu-group-title">{section.title}</h2>
        ) : (
          <div className="mb-2 flex justify-center px-3" aria-hidden>
            <span className="block h-px w-6 bg-gray-200 dark:bg-gray-800" />
          </div>
        )}
        {body}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "menu-group",
        showDivider && "border-t border-gray-100 pt-5 dark:border-white/[0.06]",
      )}
    >
      <Collapsible.Root open={open} onOpenChange={handleOpenChange}>
        <div {...hoverZoneProps}>
        {showLabels ? (
          <Collapsible.Trigger
            className="menu-group-title flex w-full cursor-pointer items-center justify-between gap-2 text-left hover:text-gray-800 dark:hover:text-white/90"
            aria-expanded={open}
            onClick={(event) => {
              event.preventDefault();
              toggleFromClick();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleFromKeyboard();
              }
            }}
          >
            <span>{section.title}</span>
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 text-gray-400 transition-transform duration-200",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </Collapsible.Trigger>
        ) : (
          <div className="mb-2 flex justify-center px-3" aria-hidden>
            <span className="block h-px w-6 bg-gray-200 dark:bg-gray-800" />
          </div>
        )}
        <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          {body}
        </Collapsible.Content>
        </div>
      </Collapsible.Root>
    </div>
  );
}

export function AppSidebar({
  sections,
  logo,
  collapsedLogo,
  widget,
  leading,
  navAriaLabel = "管理端导航",
  className,
}: AppSidebarProps) {
  const {
    isExpanded,
    isMobileOpen,
    isHovered,
    isDrawerMode,
    setIsHovered,
    setIsMobileOpen,
  } = useSidebar();
  const location = useLocation();

  const showLabels = isExpanded || isHovered || isMobileOpen;
  const isWide = isExpanded || isMobileOpen || isHovered;
  /** 抽屉视口固定 240px + 全量 Logo/导航，随面板整体滑入 */
  const brandExpanded = isDrawerMode || showLabels;
  const navShowLabels = isDrawerMode || showLabels;
  const sidebarSizeClass = isDrawerMode
    ? ADMIN_SIDEBAR_EXPANDED_CLASS
    : isWide
      ? ADMIN_SIDEBAR_EXPANDED_CLASS
      : ADMIN_SIDEBAR_COLLAPSED_CLASS;

  React.useEffect(() => {
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
    // Close mobile drawer after navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 flex h-screen flex-col border-r border-gray-200 bg-white text-gray-900 xl:translate-x-0 dark:border-gray-800 dark:bg-gray-900",
        isDrawerMode
          ? "z-[100000] transition-transform duration-300 ease-out"
          : cn(
              "transition-all duration-300 ease-in-out",
              isMobileOpen ? "z-[100000]" : "z-50",
            ),
        sidebarSizeClass,
        isDrawerMode || isMobileOpen
          ? isMobileOpen
            ? "translate-x-0"
            : "-translate-x-full"
          : undefined,
        className,
      )}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDownCapture={handleSidebarNavPointerDownCapture}
    >
      <div
        className={cn(
          "flex shrink-0 items-center border-b border-gray-200 dark:border-gray-800",
          ADMIN_HEADER_HEIGHT_CLASS,
          brandExpanded ? "justify-start" : "xl:justify-center",
        )}
      >
        {brandExpanded ? logo : (collapsedLogo ?? logo)}
      </div>

      <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto py-4 duration-300 ease-linear">
        <nav className="flex flex-1 flex-col" aria-label={navAriaLabel}>
          {leading}
          {sections.map((section, index) => (
            <SidebarSection
              key={section.title}
              section={section}
              showLabels={navShowLabels}
              showDivider={index > 0}
            />
          ))}
        </nav>
        {showLabels && widget ? widget : null}
      </div>
    </aside>
  );
}
