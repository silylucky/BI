import { forwardRef, type ButtonHTMLAttributes } from "react";
import { HintTooltip } from "@/components/ui/hint-tooltip";

export type HintButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  hint?: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
};

/** 原生 button + 统一悬停说明（替代 title） */
export const HintButton = forwardRef<HTMLButtonElement, HintButtonProps>(function HintButton(
  { hint, tooltipSide, title, children, ...props },
  ref,
) {
  const label = hint ?? (typeof title === "string" ? title : undefined);
  const button = (
    <button ref={ref} {...props}>
      {children}
    </button>
  );
  if (!label) return button;
  return (
    <HintTooltip label={label} side={tooltipSide}>
      {button}
    </HintTooltip>
  );
});
