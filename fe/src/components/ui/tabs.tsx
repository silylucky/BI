import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const tabsListVariants = cva("inline-flex items-center text-gray-500 dark:text-gray-400", {
  variants: {
    variant: {
      line: "gap-6 border-b border-gray-200 dark:border-gray-800",
      enclosed: "gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-900",
    },
    size: { sm: "text-xs", md: "text-sm", lg: "text-base" },
  },
  defaultVariants: { variant: "line", size: "md" },
});

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/20 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        line: "border-b-2 border-transparent pb-3 data-[state=active]:border-brand-500 data-[state=active]:text-brand-600 dark:data-[state=active]:text-brand-400",
        enclosed:
          "rounded-md px-3 py-2 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-theme-xs dark:data-[state=active]:bg-white/[0.06] dark:data-[state=active]:text-white",
      },
      size: { sm: "h-8 px-2", md: "h-9 px-3", lg: "h-11 px-4" },
    },
    defaultVariants: { variant: "line", size: "md" },
  },
);

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>
>(({ className, variant = "line", size = "md", ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListVariants({ variant, size }), className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & VariantProps<typeof tabsTriggerVariants>
>(({ className, variant = "line", size = "md", ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant, size }), className)}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-4 focus-visible:outline-hidden", className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
