import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const switchSizeStyles = {
  default: {
    root: "h-6 w-11",
    thumb: "size-5 data-[state=checked]:translate-x-5",
    loader: "size-3.5",
  },
  sm: {
    root: "h-4 w-7",
    thumb: "size-3 data-[state=checked]:translate-x-3",
    loader: "size-2.5",
  },
} as const;

export type SwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
  loading?: boolean;
  size?: keyof typeof switchSizeStyles;
};

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, loading = false, disabled, size = "default", ...props }, ref) => {
  const sizeStyle = switchSizeStyles[size];
  return (
  <SwitchPrimitives.Root
    className={cn(
      "peer relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-theme-sm transition-colors duration-150 ease-linear focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-brand-500 data-[state=unchecked]:bg-gray-200 dark:data-[state=unchecked]:bg-white/10",
      sizeStyle.root,
      loading && "cursor-wait opacity-80",
      className,
    )}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    data-loading={loading || undefined}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block rounded-full bg-white shadow-theme-sm ring-0 transition-transform duration-150 ease-linear data-[state=unchecked]:translate-x-0",
        sizeStyle.thumb,
      )}
    />
    {loading ? (
      <Loader2
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-brand-600",
          sizeStyle.loader,
        )}
        aria-hidden
      />
    ) : null}
  </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
