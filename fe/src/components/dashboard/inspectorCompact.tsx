import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronRight, CircleAlert } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ColorField, type ColorSwatch } from "@/components/ui/color-field";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** 看板 chart-edit 左列（~252px）/ 右列（~180px）紧凑密度，对标 DataEase editor-light */
export const INSPECTOR_CTRL = "h-8 rounded-md text-theme-xs";
export const INSPECTOR_SELECT = cn(INSPECTOR_CTRL, "w-full");
/** 覆盖 ui/select 默认 h-11·px-4，216px 栏内下拉统一外观 */
export const INSPECTOR_SELECT_TRIGGER = cn(
  INSPECTOR_SELECT,
  "min-h-8 border border-gray-200 bg-white px-2 py-0 shadow-theme-xs",
  "text-gray-800 dark:border-gray-700 dark:bg-white/[0.03] dark:text-white/90",
  "[&>svg]:size-3.5 [&>svg]:opacity-50",
);
export const INSPECTOR_LABEL = "text-[11px] font-medium text-gray-500 dark:text-gray-400";
/** @deprecated 说明改用 InspectorHintTip 悬浮展示，勿再通栏堆字 */
export const INSPECTOR_HINT = "text-[10px] leading-relaxed text-gray-400 dark:text-gray-500";
export const INSPECTOR_SECTION_GAP = "space-y-2.5";

/** 紧凑栏说明：感叹号图标，悬浮展示完整文案 */
export function InspectorHintTip({
  text,
  className,
  side = "top",
  "aria-label": ariaLabel = "字段说明",
}: {
  text: string;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  "aria-label"?: string;
}) {
  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-gray-400",
              "hover:text-gray-600 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30",
              "dark:text-gray-500 dark:hover:text-gray-300",
              className,
            )}
            aria-label={ariaLabel}
            onClick={(event) => event.stopPropagation()}
          >
            <CircleAlert className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-[240px] text-left leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function InspectorFieldLabel({
  label,
  hint,
  className,
  labelClassName,
}: {
  label: string;
  hint?: string;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <Label className={cn(INSPECTOR_LABEL, "min-w-0 truncate", labelClassName)}>{label}</Label>
      {hint ? <InspectorHintTip text={hint} aria-label={`${label}说明`} /> : null}
    </div>
  );
}
export const INSPECTOR_SWITCH_ROW = "flex items-center justify-between gap-2";
/** 看板配置轨 / 图表样式栏统一小号开关 */
export const INSPECTOR_SWITCH_SIZE = "sm" as const;
export const INSPECTOR_NESTED_CARD =
  "space-y-2 rounded-md border border-gray-200 bg-gray-50/70 p-2 dark:border-gray-800 dark:bg-white/[0.03]";

/** 样式栏折叠态：默认收起；与标题行 Switch 独立（对标 DE 开关开仍折叠） */
export function useInspectorSectionOpen(defaultOpen: boolean) {
  const [open, setOpen] = useState(defaultOpen);
  return [open, setOpen] as const;
}

/**
 * 嵌套 Collapsible 须用命名 group：匿名 `group` 会让内层箭头跟随外层 `data-state=open` 误旋转。
 * 挂在 CollapsibleTrigger 上，箭头用 InspectorCollapseChevron。
 */
export const INSPECTOR_COLLAPSE_TRIGGER = "group/collapse-trigger";

export const INSPECTOR_COLLAPSE_CHEVRON =
  "shrink-0 text-gray-400 transition-transform group-data-[state=open]/collapse-trigger:rotate-90";

export function InspectorCollapseChevron({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <ChevronRight
      className={cn(INSPECTOR_COLLAPSE_CHEVRON, size === "md" ? "size-3.5" : "size-3", className)}
      aria-hidden
    />
  );
}

export function InspectorSubtleEmpty({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "rounded-md border border-dashed border-gray-200 bg-gray-50/50 px-2 py-2 text-center text-[10px] leading-relaxed text-gray-400 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-500",
        className,
      )}
    >
      {message}
    </p>
  );
}

export function InspectorFieldRow({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid gap-1">
      <InspectorFieldLabel label={label} hint={hint} />
      {children}
    </div>
  );
}

export function InspectorSwitchRow({
  label,
  checked,
  onCheckedChange,
  disabled = false,
  hint,
  "aria-label": ariaLabel,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
  "aria-label"?: string;
}) {
  return (
    <div className="space-y-0.5">
      <div
        className={cn(
          INSPECTOR_SWITCH_ROW,
          "border-b border-gray-100 py-2 last:border-b-0 dark:border-white/[0.06]",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Label
            className={cn(
              INSPECTOR_LABEL,
              "min-w-0 font-normal",
              disabled ? "text-gray-400 dark:text-gray-500" : "text-gray-600 dark:text-gray-300",
            )}
          >
            {label}
          </Label>
          {hint ? <InspectorHintTip text={hint} aria-label={`${label}说明`} /> : null}
        </div>
        <Switch
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
          aria-label={ariaLabel ?? label}
          size={INSPECTOR_SWITCH_SIZE}
        />
      </div>
    </div>
  );
}

/** 216px 图表样式栏：功能种类折叠（无灰底条），标题行右侧可放 Switch */
export function ChartInspectorSection({
  title,
  hint,
  children,
  action,
  defaultOpen = false,
  enabled: _enabled,
  className,
  "data-testid": testId,
}: {
  title: string;
  /** 折叠标题旁悬浮说明，替代通栏 hint 段落 */
  hint?: string;
  children?: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
  /** @deprecated 开关与折叠独立，不再联动展开 */
  enabled?: boolean;
  className?: string;
  "data-testid"?: string;
}) {
  const [open, setOpen] = useInspectorSectionOpen(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      data-testid={testId}
      className={cn("border-b border-gray-100 dark:border-white/[0.06]", className)}
    >
      <div className="flex items-center gap-0.5 py-0.5">
        <CollapsibleTrigger
          className={cn(
            INSPECTOR_COLLAPSE_TRIGGER,
            "flex min-w-0 flex-1 items-center gap-0.5 rounded-md py-1 pl-0 pr-1 text-left",
            "text-[11px] font-semibold text-gray-800 dark:text-white/90",
            "transition-colors hover:bg-gray-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30",
            "dark:hover:bg-white/[0.04]",
          )}
        >
          <InspectorCollapseChevron />
          <span className="min-w-0 truncate">{title}</span>
        </CollapsibleTrigger>
        {hint ? (
          <InspectorHintTip
            text={hint}
            className="shrink-0"
            side="left"
            aria-label={`${title}说明`}
          />
        ) : null}
        {action ? (
          <div
            className="flex shrink-0 items-center pr-0.5"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {action}
          </div>
        ) : null}
      </div>
      {children ? (
        <CollapsibleContent className="space-y-0 overflow-visible pb-2">{children}</CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}

/** @deprecated 使用 ChartInspectorSection */
export const ChartInspectorFlatSection = ChartInspectorSection;

/** 432px 配置栏：标签左 + 控件右，避免色块输入通栏拉长 */
export function InspectorInlineColorRow({
  label,
  hint,
  value,
  onChange,
  swatches,
  allowClear = true,
  fallbackValue,
  className,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string | undefined) => void;
  swatches?: readonly ColorSwatch[] | readonly string[];
  allowClear?: boolean;
  fallbackValue?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-b border-gray-100 py-2 last:border-b-0 dark:border-white/[0.06]",
        className,
      )}
    >
      <InspectorFieldLabel label={label} hint={hint} className="shrink-0" />
      <ColorField
        variant="swatch"
        showLabel={false}
        showHintTooltip={false}
        allowClear={allowClear}
        swatches={swatches}
        value={value}
        fallbackValue={fallbackValue}
        buttonAriaLabel={`${label}取色器`}
        popoverContentProps={{
          side: "left",
          align: "end",
          collisionPadding: 16,
          avoidCollisions: true,
        }}
        onChange={onChange}
      />
    </div>
  );
}
