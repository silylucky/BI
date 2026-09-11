import type { ReactElement, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type HintTooltipProps = {
  label: string;
  side?: "top" | "right" | "bottom" | "left";
  children: ReactElement;
  className?: string;
};

/** 替代原生 title：统一 Radix 浮层样式 */
export function HintTooltip({ label, side = "top", children, className }: HintTooltipProps) {
  if (!label.trim()) return children;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export type TruncateHintProps = {
  title: string;
  children: ReactNode;
  className?: string;
  as?: "span" | "p";
};

/** 截断文本悬停展示全文 */
export function TruncateHint({ title, children, className, as: Tag = "span" }: TruncateHintProps) {
  if (!title.trim()) {
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <HintTooltip label={title}>
      <Tag
        className={cn(Tag === "p" ? "block w-full min-w-0 truncate" : "inline-block max-w-full truncate", className)}
      >
        {children}
      </Tag>
    </HintTooltip>
  );
}
