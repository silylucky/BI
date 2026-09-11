import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        solid:
          "bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300",
        primary:
          "bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300",
        subtle:
          "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/20",
        surface:
          "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20 dark:hover:bg-brand-500/15",
        outline:
          "bg-white text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-white/[0.04]",
        ghost:
          "text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200",
        dashed:
          "border border-dashed border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.03]",
        filled:
          "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-white/10 dark:text-white/90 dark:hover:bg-white/15",
        plain:
          "h-auto min-h-0 px-0 py-0 text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300",
        destructive:
          "bg-error-500 text-white shadow-theme-xs hover:bg-error-600",
      },
      size: {
        xs: "h-8 gap-1.5 px-2.5 text-xs [&_svg]:size-3.5",
        sm: "h-9 gap-1.5 px-3.5 text-sm [&_svg]:size-4",
        md: "h-10 gap-2 px-4 text-sm [&_svg]:size-4",
        lg: "h-11 gap-2 px-5 text-sm [&_svg]:size-[1.125rem]",
        icon: "size-9 [&_svg]:size-4",
      },
    },
    compoundVariants: [
      {
        variant: ["solid", "primary", "destructive"],
        className: "text-white",
      },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: React.ReactNode;
  spinner?: React.ReactNode;
  spinnerPlacement?: "start" | "end";
  tooltip?: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
}

function ButtonSpinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80",
        className,
      )}
    />
  );
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      disabled,
      loading = false,
      loadingText,
      spinner,
      spinnerPlacement = "start",
      children,
      tooltip,
      tooltipSide,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const loadingIndicator = spinner ?? <ButtonSpinner />;
    const content = loading && loadingText ? loadingText : children;

    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          aria-busy={loading || undefined}
          data-loading={loading || undefined}
          ref={ref}
          {...props}
        >
          {content}
        </Comp>
      );
    }

    const button = (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        data-loading={loading || undefined}
        ref={ref}
        {...props}
      >
        {loading && spinnerPlacement === "start" ? loadingIndicator : null}
        {content}
        {loading && spinnerPlacement === "end" ? loadingIndicator : null}
      </Comp>
    );
    if (!tooltip) return button;
    return (
      <HintTooltip label={tooltip} side={tooltipSide}>
        {button}
      </HintTooltip>
    );
  },
);
Button.displayName = "Button";

export interface IconButtonProps extends Omit<ButtonProps, "size" | "title"> {
  "aria-label": string;
  /** 悬停说明；默认与 aria-label 相同 */
  tooltip?: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  showTooltip?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "icon";
  rounded?: "default" | "full";
}

const iconButtonSizeClass = {
  xs: "size-7 [&_svg]:size-3.5",
  sm: "size-8 [&_svg]:size-4",
  md: "size-9 [&_svg]:size-4",
  lg: "size-10 [&_svg]:size-[1.125rem]",
  icon: "size-9 [&_svg]:size-4",
} as const;

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      size = "sm",
      rounded = "default",
      children,
      tooltip,
      tooltipSide,
      showTooltip = true,
      "aria-label": ariaLabel,
      ...props
    },
    ref,
  ) => {
    const button = (
      <Button
        ref={ref}
        size="icon"
        className={cn(iconButtonSizeClass[size], rounded === "full" && "rounded-full", className)}
        aria-label={ariaLabel}
        {...props}
      >
        {children}
      </Button>
    );
    const hint = tooltip ?? ariaLabel;
    if (!showTooltip || !hint) return button;
    return <HintTooltip label={hint} side={tooltipSide}>{button}</HintTooltip>;
  },
);
IconButton.displayName = "IconButton";

export interface CloseButtonProps extends Omit<IconButtonProps, "aria-label"> {
  "aria-label"?: string;
}

const CloseButton = React.forwardRef<HTMLButtonElement, CloseButtonProps>(
  ({ children, variant = "ghost", "aria-label": ariaLabel = "Close", ...props }, ref) => (
    <IconButton ref={ref} aria-label={ariaLabel} variant={variant} {...props}>
      {children ?? <X />}
    </IconButton>
  ),
);
CloseButton.displayName = "CloseButton";

type DownloadPayload = string | Blob | File;

export interface DownloadTriggerProps extends Omit<ButtonProps, "onClick"> {
  data: DownloadPayload | Promise<DownloadPayload>;
  fileName: string;
  mimeType?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onDownloaded?: () => void;
}

const DownloadTrigger = React.forwardRef<HTMLButtonElement, DownloadTriggerProps>(
  (
    { data, fileName, mimeType = "application/octet-stream", onClick, onDownloaded, children = "Download", ...props },
    ref,
  ) => {
    const handleClick: React.MouseEventHandler<HTMLButtonElement> = async (event) => {
      onClick?.(event);
      if (event.defaultPrevented || typeof document === "undefined") return;

      const payload = await data;
      const blob = payload instanceof Blob ? payload : new Blob([payload], { type: mimeType });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = payload instanceof File ? payload.name : fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      onDownloaded?.();
    };

    return (
      <Button ref={ref} onClick={handleClick} {...props}>
        {children}
      </Button>
    );
  },
);
DownloadTrigger.displayName = "DownloadTrigger";

export { Button, ButtonSpinner, CloseButton, DownloadTrigger, IconButton, buttonVariants };
