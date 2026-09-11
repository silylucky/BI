import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 检查栏内二级分组：静态标题 + 内容，不可折叠（避免「一级折叠里再套二级折叠」）。
 */
export function InspectorNestedSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  /** @deprecated 二级分组不再折叠，忽略 */
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-gray-100 py-1 dark:border-white/[0.06]", className)}>
      <p className="pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {title}
      </p>
      <div className="space-y-2 pb-1">{children}</div>
    </div>
  );
}
