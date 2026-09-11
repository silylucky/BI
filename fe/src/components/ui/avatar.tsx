import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const avatarVariants = cva("relative flex shrink-0 overflow-hidden", {
  variants: {
    size: {
      sm: "size-8",
      md: "size-10",
      lg: "size-12",
      xl: "size-16",
    },
    shape: {
      circle: "rounded-full",
      square: "rounded-lg",
    },
  },
  defaultVariants: {
    size: "md",
    shape: "circle",
  },
});

const FALLBACK_COLORS = [
  "bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
  "bg-pink-100 text-pink-600 dark:bg-pink-500/15 dark:text-pink-400",
  "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400",
  "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400",
  "bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  "bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400",
  "bg-yellow-100 text-yellow-600 dark:bg-yellow-500/15 dark:text-yellow-400",
  "bg-error-100 text-error-600 dark:bg-error-500/15 dark:text-error-400",
] as const;

function hashName(name: string): number {
  return name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const words = trimmed.split(/\s+/);
  if (words.length > 1) {
    return words
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return trimmed.slice(0, 2);
}

function getFallbackColorClass(name: string): string {
  return FALLBACK_COLORS[hashName(name) % FALLBACK_COLORS.length];
}

export interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, size, shape, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(avatarVariants({ size, shape }), className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square size-full object-cover", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

export interface AvatarFallbackProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> {
  name?: string;
}

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  AvatarFallbackProps
>(({ className, name, children, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex size-full items-center justify-center text-sm font-medium",
      name
        ? getFallbackColorClass(name)
        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
      className,
    )}
    {...props}
  >
    {children ?? (name ? getInitials(name) : null)}
  </AvatarPrimitive.Fallback>
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback, avatarVariants, getInitials };
