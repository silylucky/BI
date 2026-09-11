import { useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cva } from "class-variance-authority";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getScreenBorderCatalogItems } from "@/lib/screenMaterialCatalog";
import type { ScreenBorderStyleConfig, ScreenBorderVariant } from "@/lib/screenVisualStyle";
import { ScreenBorderStyleThumbnail } from "./screenBorderVariants";

const triggerShellVariants = cva(
  "flex h-9 min-w-0 w-full overflow-hidden rounded-lg border bg-white text-left shadow-theme-xs transition-[border-color,box-shadow] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30 dark:bg-white/[0.03]",
  {
    variants: {
      open: {
        true: "border-brand-300 ring-2 ring-brand-500/20 dark:border-brand-500/50",
        false:
          "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600",
      },
    },
    defaultVariants: {
      open: false,
    },
  },
);

function variantIndex(variant: ScreenBorderVariant): string {
  const match = variant.match(/(\d+)$/);
  return match?.[1] ?? "1";
}

type ScreenBorderVariantPickerProps = {
  style: ScreenBorderStyleConfig;
  onChange: (variant: ScreenBorderVariant) => void;
  className?: string;
};

function BorderThumbFrame({ children }: { children: ReactNode }) {
  return (
    <span className="relative block size-full overflow-hidden rounded-[5px] border border-gray-200/90 dark:border-white/10">
      {children}
    </span>
  );
}

export function ScreenBorderVariantPicker({
  style,
  onChange,
  className,
}: ScreenBorderVariantPickerProps) {
  const [open, setOpen] = useState(false);
  const indexLabel = variantIndex(style.variant ?? "border-1");
  const selectedLabel =
    getScreenBorderCatalogItems().find((item) => item.payload.preset === style.variant)?.label ??
    `边框${indexLabel}`;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(triggerShellVariants({ open }), className)}
          aria-label="边框样式"
          aria-expanded={open}
          data-testid="border-variant-select"
          onMouseDown={(event) => event.preventDefault()}
        >
          <span
            className="flex h-full w-11 shrink-0 items-center justify-center border-r border-gray-100 bg-gray-50/90 p-1 dark:border-gray-800 dark:bg-white/[0.04]"
            aria-hidden
          >
            <BorderThumbFrame>
              <ScreenBorderStyleThumbnail styleConfig={style} />
            </BorderThumbFrame>
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2 px-2.5">
            <span className="min-w-0 flex-1 truncate text-theme-xs text-gray-700 dark:text-gray-200">
              {selectedLabel}
            </span>
            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-gray-100 text-[10px] font-semibold tabular-nums text-gray-700 dark:bg-white/10 dark:text-gray-200">
              {indexLabel}
            </span>
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 text-gray-400 transition-transform dark:text-gray-500",
                open && "rotate-180 text-brand-500 dark:text-brand-400",
              )}
              aria-hidden
            />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        collisionPadding={12}
        className="w-[min(15.5rem,calc(100vw-2rem))] max-h-[min(70vh,20rem)] overflow-y-auto overscroll-contain p-2.5"
        sideOffset={6}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <p className="mb-2 text-[10px] font-medium text-gray-500 dark:text-gray-400">边框样式</p>
        <div className="grid grid-cols-3 gap-1.5" role="listbox" aria-label="边框样式">
          {getScreenBorderCatalogItems().map((item) => {
            const variant = item.payload.preset as ScreenBorderVariant;
            const active = variant === style.variant;
            const previewStyle = { ...style, variant };
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={active}
                aria-label={item.label}
                title={item.label}
                data-testid={`border-variant-${variant}`}
                className={cn(
                  "group relative aspect-[4/3] overflow-hidden rounded-lg border bg-gray-50/80 p-1 transition-colors dark:bg-white/[0.03]",
                  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30",
                  active
                    ? "border-brand-500 ring-1 ring-brand-500/30 dark:border-brand-500/70"
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600",
                )}
                onClick={() => {
                  onChange(variant);
                  setOpen(false);
                }}
              >
                <BorderThumbFrame>
                  <ScreenBorderStyleThumbnail styleConfig={previewStyle} />
                </BorderThumbFrame>
                <span className="absolute bottom-1.5 right-1.5 rounded bg-white/90 px-1 py-px text-[9px] font-medium tabular-nums text-gray-600 shadow-theme-xs dark:bg-gray-900/90 dark:text-gray-300">
                  {variantIndex(variant)}
                </span>
                {active ? (
                  <span className="absolute left-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-brand-500 text-white shadow-theme-xs">
                    <Check className="size-2.5" aria-hidden />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
