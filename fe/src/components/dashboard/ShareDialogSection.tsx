import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ShareDialogSectionProps = {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  notice?: ReactNode;
  /** 标题行右侧操作（如生成链接按钮） */
  trailing?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** 分享弹窗内区块：图标标题 + 说明 + 右侧操作，无嵌套 Card */
export function ShareDialogSection({
  icon: Icon,
  title,
  description,
  notice,
  trailing,
  children,
  className,
}: ShareDialogSectionProps) {
  return (
    <section className={cn("py-5 first:pt-2 last:pb-2", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {Icon ? (
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
              <Icon className="size-4" aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0 flex-1 space-y-1.5">
            <h4 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">{title}</h4>
            {description ? (
              <div className="text-theme-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {description}
              </div>
            ) : null}
          </div>
        </div>
        {trailing ? <div className="shrink-0 pt-0.5">{trailing}</div> : null}
      </div>
      {notice ? <div className={cn("mt-3", Icon && "pl-12")}>{notice}</div> : null}
      {children ? <div className={cn("mt-4", Icon && "pl-12")}>{children}</div> : null}
    </section>
  );
}

export function ShareDialogNotice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-theme-sm leading-relaxed text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-400">
      {children}
    </p>
  );
}

export function ShareDialogList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul
      className={cn(
        "divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100 dark:divide-gray-800 dark:border-gray-800",
        className,
      )}
    >
      {children}
    </ul>
  );
}

export function ShareDialogListItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-4 bg-white px-4 py-3 transition-colors hover:bg-gray-50/80 dark:bg-transparent dark:hover:bg-white/[0.02]",
        className,
      )}
    >
      {children}
    </li>
  );
}
