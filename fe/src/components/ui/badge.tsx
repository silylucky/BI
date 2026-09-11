import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-full font-medium",
  {
    variants: {
      variant: {
        light: "",
        solid: "",
        outline: "border bg-transparent",
        subtle: "",
        surface: "border",
      },
      color: {
        primary: "",
        success: "",
        error: "",
        warning: "",
        info: "",
        light: "",
        dark: "",
      },
      size: {
        sm: "px-2 py-0.5 text-theme-xs",
        md: "px-2.5 py-0.5 text-sm",
      },
    },
    compoundVariants: [
      {
        variant: "light",
        color: "primary",
        className: "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400",
      },
      {
        variant: "light",
        color: "success",
        className: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
      },
      {
        variant: "light",
        color: "error",
        className: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
      },
      {
        variant: "light",
        color: "warning",
        className: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400",
      },
      {
        variant: "light",
        color: "info",
        className: "bg-blue-light-50 text-blue-light-500 dark:bg-blue-light-500/15 dark:text-blue-light-500",
      },
      {
        variant: "light",
        color: "light",
        className: "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80",
      },
      {
        variant: "solid",
        color: "success",
        className: "bg-success-500 text-white",
      },
      {
        variant: "solid",
        color: "error",
        className: "bg-error-500 text-white",
      },
      {
        variant: "solid",
        color: "warning",
        className: "bg-warning-500 text-white",
      },
      {
        variant: "solid",
        color: "primary",
        className: "bg-brand-500 text-white",
      },
    ],
    defaultVariants: {
      variant: "light",
      color: "primary",
      size: "md",
    },
  },
);

export interface BadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    VariantProps<typeof badgeVariants> {
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

function Badge({
  className,
  variant,
  color,
  size,
  startIcon,
  endIcon,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, color, size }), className)} {...props}>
      {startIcon}
      {children}
      {endIcon}
    </span>
  );
}

export { Badge, badgeVariants };
