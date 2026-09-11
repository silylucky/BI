import type { ReactNode } from "react";
import { ClipboardList, Copy, Fingerprint, Target, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { TruncateHint } from "@/components/ui/hint-tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  auditActionLabel,
  auditTargetTypeLabel,
  formatAuditDetailPretty,
  formatAuditTimestamp,
  parseAuditDetailEntries,
  type AuditEventRow,
} from "./audit-display";

type AuditDetailSheetProps = {
  event: AuditEventRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function MetaCard({
  label,
  icon,
  children,
  mono = false,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-center gap-1.5 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 text-theme-sm text-gray-800 dark:text-white/90",
          mono && "break-all font-mono text-theme-xs leading-relaxed",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function CopyableId({ label, value }: { label: string; value: string }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label}已复制`);
    } catch {
      toast.error("复制失败");
    }
  };

  return (
    <div className="flex items-start gap-2">
      <TruncateHint title={value} as="p" className="min-w-0 flex-1 font-mono text-theme-xs leading-relaxed">
        {value}
      </TruncateHint>
      <IconButton
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`复制${label}`}
        className="shrink-0"
        onClick={() => void handleCopy()}
      >
        <Copy className="size-3.5" aria-hidden />
      </IconButton>
    </div>
  );
}

export function AuditDetailSheet({ event, open, onOpenChange }: AuditDetailSheetProps) {
  const stamp = event ? formatAuditTimestamp(event.created_at) : null;
  const detailEntries = event ? parseAuditDetailEntries(event.detail) : [];
  const hasStructuredDetail = detailEntries.length > 0 && detailEntries[0]?.key !== "_raw";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="edit" className="flex flex-col">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-3 pr-8 text-title-sm">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shadow-theme-xs dark:bg-brand-500/10 dark:text-brand-400">
              <ClipboardList className="size-5" aria-hidden />
            </span>
            审计事件详情
          </SheetTitle>
          <SheetDescription>完整操作上下文与变更详情（已脱敏）。</SheetDescription>
        </SheetHeader>

        {event ? (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            <section className="rounded-xl border border-brand-200/80 bg-brand-50/40 p-4 shadow-theme-xs dark:border-brand-500/20 dark:bg-brand-500/5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <Badge variant="light" color="primary" size="sm">
                    {auditActionLabel(event.action)}
                  </Badge>
                  <p className="break-all font-mono text-theme-xs text-gray-500 dark:text-gray-400">
                    {event.action}
                  </p>
                </div>
                {stamp ? (
                  <div className="shrink-0 text-right">
                    <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">{stamp.date}</p>
                    <p className="mt-0.5 font-mono text-theme-xs text-gray-500 dark:text-gray-400">{stamp.time}</p>
                  </div>
                ) : (
                  <p className="text-theme-xs text-gray-500">{event.created_at}</p>
                )}
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <MetaCard label="操作者" icon={<UserRound className="size-3.5" aria-hidden />}>
                {event.actor_username ?? event.actor_id}
              </MetaCard>
              <MetaCard label="目标" icon={<Target className="size-3.5" aria-hidden />}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="light" color="light" size="sm">
                    {auditTargetTypeLabel(event.target_type)}
                  </Badge>
                  <TruncateHint
                    title={event.target_id}
                    as="span"
                    className="font-mono text-theme-xs text-gray-500 dark:text-gray-400"
                  >
                    {event.target_id}
                  </TruncateHint>
                </div>
              </MetaCard>
              <MetaCard label="Trace ID" icon={<Fingerprint className="size-3.5" aria-hidden />} mono>
                <CopyableId label="Trace ID" value={event.trace_id} />
              </MetaCard>
              <MetaCard label="事件 ID" mono>
                <CopyableId label="事件 ID" value={event.id} />
              </MetaCard>
            </section>

            <section className="space-y-3">
              <h3 className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">变更详情</h3>
              {hasStructuredDetail ? (
                <dl className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                  {detailEntries.map((entry, index) => (
                    <div
                      key={entry.key}
                      className={cn(
                        "grid gap-1 px-4 py-3 sm:grid-cols-[7rem_1fr] sm:gap-4",
                        index > 0 && "border-t border-gray-100 dark:border-white/[0.06]",
                      )}
                    >
                      <dt className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">{entry.label}</dt>
                      <dd className="break-all text-theme-sm text-gray-800 dark:text-white/90">{entry.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <pre className="max-h-72 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-4 font-mono text-theme-xs leading-relaxed text-gray-700 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300">
                  {formatAuditDetailPretty(event.detail)}
                </pre>
              )}
            </section>
          </div>
        ) : null}

        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
