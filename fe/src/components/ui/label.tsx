import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({
  className,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "text-sm font-medium text-gray-700 dark:text-gray-300",
        className,
      )}
      {...props}
    />
  );
}

export function RequiredLabel({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label className={className} {...props}>
      {children}
      <span aria-hidden="true" className="text-error-500">
        {" "}
        *
      </span>
      <span className="sr-only">（必填）</span>
    </Label>
  );
}
