import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ConnectionFormFieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
};

export function ConnectionFormField({
  label,
  htmlFor,
  hint,
  className,
  children,
}: ConnectionFormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={htmlFor} className="text-theme-sm">
        {label}
      </Label>
      <div className="min-h-11">{children}</div>
      {hint ? (
        <p className="text-theme-xs leading-relaxed text-gray-500 dark:text-gray-400">{hint}</p>
      ) : null}
    </div>
  );
}

export const CONNECTION_CONTROL_CLASS = "h-11";
