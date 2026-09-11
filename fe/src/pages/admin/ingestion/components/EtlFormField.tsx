import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type EtlFormFieldProps = {
  label: string;
  htmlFor?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** 清洗规则表单字段：标签行固定高度，右侧预留操作位，保证两列控件对齐。 */
export function EtlFormField({
  label,
  htmlFor,
  action,
  className,
  children,
}: EtlFormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-theme-sm">
          {label}
        </Label>
        {action ?? <span className="inline-flex h-7 shrink-0" aria-hidden />}
      </div>
      <div className="min-h-11">{children}</div>
    </div>
  );
}
