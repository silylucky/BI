import { IconButton } from "@/components/ui/button";
import { RailFoldIcon } from "./RailFoldTab";

export function WidgetRailCollapseButton({
  onClick,
  ariaLabel = "收起配置",
}: {
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <IconButton
      type="button"
      variant="ghost"
      size="sm"
      className="size-7 shrink-0 text-gray-400 hover:bg-white hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-300"
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <RailFoldIcon />
    </IconButton>
  );
}

/** 单列组件配置栏顶栏（对标 DatasetPickerPanel「收起」） */
export function WidgetRailPanelHeader({
  title,
  subtitle,
  onCollapse,
  collapseAriaLabel,
}: {
  title: string;
  subtitle?: string;
  onCollapse?: () => void;
  collapseAriaLabel?: string;
}) {
  return (
    <div className="shrink-0 border-b border-gray-200 px-3 py-2.5 dark:border-gray-800">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate text-theme-xs font-semibold text-gray-800 dark:text-white/90">
          {title}
        </h3>
        {onCollapse ? (
          <WidgetRailCollapseButton
            onClick={onCollapse}
            ariaLabel={collapseAriaLabel ?? `收起${title}`}
          />
        ) : null}
      </div>
      {subtitle ? (
        <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{subtitle}</p>
      ) : null}
    </div>
  );
}
