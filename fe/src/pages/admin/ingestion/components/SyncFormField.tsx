import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type SyncFormFieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function SyncFormField({
  label,
  htmlFor,
  hint,
  action,
  className,
  children,
}: SyncFormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-theme-sm">
          {label}
        </Label>
        {action ?? <span className="inline-flex h-7 shrink-0" aria-hidden />}
      </div>
      <div className="min-h-11">{children}</div>
      {hint ? (
        <p className="text-theme-xs leading-relaxed text-gray-500 dark:text-gray-400">{hint}</p>
      ) : null}
    </div>
  );
}

export const SYNC_CONTROL_CLASS = "h-11";
