import type { ReactNode } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TitleStyleConfig } from "./dashboardStyleConfig";
import { CHART_FONT_SIZE_OPTIONS, resolveChartFontSizeOptions } from "@/lib/chartFontSizes";
import { ChartDeAttrSliderField } from "./deAttrSlider";

/** @deprecated 使用 CHART_FONT_SIZE_OPTIONS */
export const CHART_TITLE_FONT_SIZES: readonly number[] = [...CHART_FONT_SIZE_OPTIONS];

export type DeTitleStyleToolbarValue = Pick<
  TitleStyleConfig,
  "fontSize" | "fontWeight" | "fontStyle" | "align" | "letterSpacing" | "shadow"
>;

type DeTitleStyleToolbarProps = {
  value: DeTitleStyleToolbarValue;
  onChange: (patch: Partial<TitleStyleConfig>) => void;
  defaultFontSize?: number;
  className?: string;
  "data-testid"?: string;
};

const TOOLBAR_SHELL =
  "flex min-w-0 flex-col gap-1 rounded-lg border border-gray-200 bg-gray-50/90 p-1 shadow-theme-xs dark:border-gray-700 dark:bg-white/[0.03]";

const TOOLBAR_ROW = "flex min-w-0 flex-wrap items-center gap-0.5";

const FONT_SIZE_TRIGGER =
  "h-8 min-h-8 w-[3.75rem] shrink-0 rounded-md border-0 bg-white px-2 py-0 text-xs shadow-none ring-1 ring-inset ring-gray-200 hover:bg-gray-50 focus-visible:ring-brand-500/30 data-[state=open]:ring-brand-500/40 dark:bg-gray-900 dark:ring-gray-600 dark:hover:bg-white/[0.04]";

function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-gray-200 dark:bg-gray-700" aria-hidden />;
}

function ToolbarIconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <IconButton
      type="button"
      variant="ghost"
      size="xs"
      className={cn(
        "size-8 shrink-0 rounded-md text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white",
        active &&
          "bg-white text-brand-500 shadow-theme-xs ring-1 ring-inset ring-brand-200 hover:bg-white hover:text-brand-600 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/30 dark:hover:bg-brand-500/15",
      )}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </IconButton>
  );
}

function fontSizeOptions(current: number | undefined, fallback: number): number[] {
  return resolveChartFontSizeOptions(current, fallback, CHART_FONT_SIZE_OPTIONS);
}

/** 紧凑文本样式工具条：字号 / 粗体 / 斜体 / 字间距 / 对齐 */
export function DeTitleStyleToolbar({
  value,
  onChange,
  defaultFontSize = 16,
  className,
  "data-testid": testId = "de-title-style-toolbar",
}: DeTitleStyleToolbarProps) {
  const fontSize = value.fontSize ?? defaultFontSize;
  const fontWeight = value.fontWeight ?? 400;
  const isBold = fontWeight >= 600;
  const isItalic = value.fontStyle === "italic";
  const align = value.align ?? "left";
  const sizes = fontSizeOptions(value.fontSize, defaultFontSize);

  return (
    <div data-testid={testId} className={cn(TOOLBAR_SHELL, className)}>
      <div className={TOOLBAR_ROW}>
        <Select
          value={String(fontSize)}
          onValueChange={(next) => onChange({ fontSize: Number(next) })}
        >
          <SelectTrigger className={FONT_SIZE_TRIGGER} aria-label="字号">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-99999 max-h-56 min-w-[5.5rem]">
            {sizes.map((size) => (
              <SelectItem key={size} value={String(size)} className="text-sm">
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ToolbarIconButton
          label="粗体"
          active={isBold}
          onClick={() => onChange({ fontWeight: isBold ? 400 : 600 })}
        >
          <Bold className="size-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          label="斜体"
          active={isItalic}
          onClick={() => onChange({ fontStyle: isItalic ? "normal" : "italic" })}
        >
          <Italic className="size-4" />
        </ToolbarIconButton>
      </div>

      <div className={cn(TOOLBAR_ROW, "w-full px-0.5")}>
        <ToolbarIconButton
          label="左对齐"
          active={align === "left"}
          onClick={() => onChange({ align: "left" })}
        >
          <AlignLeft className="size-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          label="居中对齐"
          active={align === "center"}
          onClick={() => onChange({ align: "center" })}
        >
          <AlignCenter className="size-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          label="右对齐"
          active={align === "right"}
          onClick={() => onChange({ align: "right" })}
        >
          <AlignRight className="size-4" />
        </ToolbarIconButton>

        <Divider />

        <div className="min-w-0 flex-1 px-1">
          <ChartDeAttrSliderField
            compact
            label="字间距"
            value={value.letterSpacing}
            fallback={0}
            min={-2}
            max={8}
            step={1}
            unit="px"
            onChange={(letterSpacing) => onChange({ letterSpacing })}
          />
        </div>
      </div>
    </div>
  );
}
