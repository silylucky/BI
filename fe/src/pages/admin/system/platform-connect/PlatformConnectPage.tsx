import { useQuery } from "@tanstack/react-query";
import { Info, Link2 } from "lucide-react";
import { useState } from "react";
import {
  AdminPageHeaderIcon,
  AdminPageShell,
} from "@/components/layout/admin-page-shell";
import { ListPageSection } from "@/components/layout/list-page-kit";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { DEFAULT_EMAIL_SMTP_SLOT, type EmailSmtpSlot } from "@/lib/emailSmtpSlots";
import { queryKeys } from "@/lib/queryKeys";
import { EmailSmtpSlotForm } from "./EmailSmtpSlotForm";
import { ChannelPickerCard } from "./platformConnectUi";
import { SystemAdminScopeHint } from "../SystemAdminScopeHint";

type EmailConfig = {
  slot: EmailSmtpSlot;
  label: string;
  configured: boolean;
  source: "db" | "env" | "none";
  host?: string | null;
  port?: number | null;
  from?: string | null;
  username?: string | null;
  hasPassword: boolean;
  probeStatus?: string | null;
  probeError?: string | null;
};

type EmailSlotsResponse = { items: EmailConfig[] };

export function PlatformConnectPage() {
  const [activeSlot, setActiveSlot] = useState<EmailSmtpSlot>(DEFAULT_EMAIL_SMTP_SLOT);
  const configQuery = useQuery({
    queryKey: queryKeys.platformConnect.emailSlots,
    queryFn: () => apiFetch<EmailSlotsResponse>("/api/v1/platform/delivery/email/slots"),
  });

  const items = configQuery.data?.items ?? [];
  const activeEmailConfig = items.find((item) => item.slot === activeSlot);
  const pending = configQuery.isLoading;

  return (
    <AdminPageShell
      title="平台对接"
      description="配置邮件 SMTP，供定时报告等场景发信。"
      headerIcon={
        <AdminPageHeaderIcon>
          <Link2 className="size-5" aria-hidden />
        </AdminPageHeaderIcon>
      }
    >
      {configQuery.isError ? (
        <PageErrorBanner
          message={mapApiError(configQuery.error)}
          onRetry={() => void configQuery.refetch()}
        />
      ) : null}

      <div className="mx-auto w-full max-w-6xl px-1">
        <SystemAdminScopeHint scope="platform-connect" />
      </div>

      <ListPageSection className="mx-auto w-full max-w-6xl">
        {pending ? (
          <div className="space-y-5 p-5 md:p-6">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="px-5 py-5 md:px-6">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shadow-theme-xs dark:bg-brand-500/10 dark:text-brand-400">
                  <Link2 className="size-4" aria-hidden />
                </span>
                <div>
                  <h2 className="text-theme-sm font-semibold text-gray-900 dark:text-white">邮件发信</h2>
                  <p className="mt-0.5 text-theme-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    配置 QQ / 163 等 SMTP 槽位；定时任务将使用所选槽位发信。
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                {items.map((config) => (
                  <ChannelPickerCard
                    key={config.slot}
                    config={config}
                    active={activeSlot === config.slot}
                    onSelect={() => setActiveSlot(config.slot)}
                  />
                ))}
              </div>

              <div className="mt-5">
                {activeEmailConfig ? (
                  <EmailSmtpSlotForm
                    key={activeEmailConfig.slot}
                    config={activeEmailConfig}
                    disabled={pending}
                    onSaved={() => void configQuery.refetch()}
                  />
                ) : null}
              </div>
            </div>

            <div className="flex items-start gap-2.5 border-t border-gray-100 px-5 py-4 dark:border-white/[0.06] md:px-6">
              <Info className="mt-0.5 size-4 shrink-0 text-gray-400" aria-hidden />
              <p className="text-theme-xs leading-relaxed text-gray-500 dark:text-gray-400">
                清空某槽位后，即使环境变量仍有旧值，该槽位也不会再发信。
              </p>
            </div>
          </div>
        )}
      </ListPageSection>
    </AdminPageShell>
  );
}
