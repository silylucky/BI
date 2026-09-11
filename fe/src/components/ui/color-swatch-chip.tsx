import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

const CHECKERBOARD_STYLE: CSSProperties = {
  backgroundColor: "#f9fafb",
  backgroundImage:
    "linear-gradient(45deg,#e4e7ec 25%,transparent 25%),linear-gradient(-45deg,#e4e7ec 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e4e7ec 75%),linear-gradient(-45deg,transparent 75%,#e4e7ec 75%)",
  backgroundSize: "8px 8px",
  backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
};

type ColorSwatchChipProps = {
  color?: string;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  className?: string;
};

const SIZE_CLASS = {
  sm: "size-5",
  md: "size-6",
  lg: "size-7",
} as const;

/** TailAdmin 风格色块：棋盘格底 + 细环，浅色/透明在 Popover 白底上仍可见 */
export function ColorSwatchChip({
  color,
  size = "md",
  selected = false,
  className,
}: ColorSwatchChipProps) {
  return (
    <span
      className={cn(
        SIZE_CLASS[size],
        "relative shrink-0 overflow-hidden rounded-[5px] shadow-theme-xs ring-1 ring-gray-300 dark:ring-gray-600",
        selected &&
          "ring-2 ring-brand-500 ring-offset-1 ring-offset-white dark:ring-offset-gray-900",
        className,
      )}
      aria-hidden
    >
      <span className="absolute inset-0" style={CHECKERBOARD_STYLE} />
      {color ? (
        <span
          className="absolute inset-[2px] rounded-[3px] border border-black/[0.06] dark:border-white/10"
          style={{ backgroundColor: color }}
        />
      ) : null}
    </span>
  );
}
