import { parseCronToWizard } from "@/lib/scheduleCronWizard";
import {
  DEFAULT_SCHEDULE_FORM,
  type ScheduleFormValue,
} from "./components/ScheduleFormFields";
import { DEFAULT_EMAIL_RECIPIENTS } from "./components/ScheduleRecipientsField";
import type { ReportScheduleRow, ScheduleRecipient } from "./useReportSchedules";

import {
  DEFAULT_EMAIL_SMTP_SLOT,
  type EmailSmtpSlot,
} from "@/lib/emailSmtpSlots";

export const EMAIL_ONLY_DELIVERY: Pick<
  ScheduleFormValue,
  "deliveryChannels" | "emailSmtpSlot"
> = {
  deliveryChannels: ["email"],
  emailSmtpSlot: DEFAULT_EMAIL_SMTP_SLOT,
};

export function deliveryPayloadFromForm(
  form: Pick<ScheduleFormValue, "deliveryChannels" | "emailSmtpSlot">,
) {
  return {
    deliveryChannels: ["email"] as const,
    emailSmtpSlot: form.emailSmtpSlot,
  };
}

export function pickActiveSchedule(items: ReportScheduleRow[]): ReportScheduleRow | null {
  return items.find((item) => item.status !== "cancelled") ?? null;
}

/** 邮件投递场景：仅保留显式邮箱行，便于多收件人直填。 */
export function toEmailOnlyRecipients(recipients: ScheduleRecipient[]): ScheduleRecipient[] {
  const emails = recipients
    .filter((row) => row.type === "email" && row.value.trim())
    .map((row) => ({ type: "email" as const, value: row.value.trim() }));
  return emails.length > 0 ? emails : DEFAULT_EMAIL_RECIPIENTS;
}

export function scheduleRowToForm(schedule: ReportScheduleRow): ScheduleFormValue {
  return {
    wizard: parseCronToWizard(schedule.cron) ?? DEFAULT_SCHEDULE_FORM.wizard,
    cron: schedule.cron,
    showAdvancedCron: false,
    timezone: schedule.timezone,
    recipients: schedule.recipients?.length
      ? schedule.recipients.map((r) => ({
          type: r.type as ScheduleRecipient["type"],
          value: r.value,
        }))
      : DEFAULT_SCHEDULE_FORM.recipients,
    attachmentFormats: (schedule.attachmentFormats?.length
      ? schedule.attachmentFormats
      : ["pdf"]) as ScheduleFormValue["attachmentFormats"],
    deliveryChannels: ["email"],
    emailSmtpSlot: (schedule.emailSmtpSlot === "163" ? "163" : "qq") as EmailSmtpSlot,
  };
}
