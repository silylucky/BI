import type { ScheduleRecipient } from "./useReportSchedules";
import { isValidRecipient } from "./components/ScheduleRecipientsField";
import type { DeliveryChannel } from "./components/ScheduleDeliveryChannelsField";

/** 校验用表单切片，避免与 ScheduleFormFields 循环 import。 */
type ScheduleDeliveryForm = {
  deliveryChannels: DeliveryChannel[];
  recipients: ScheduleRecipient[];
};

export function hasPlatformRecipients(recipients: ScheduleRecipient[]): boolean {
  return recipients.some(
    (row) => (row.type === "role" || row.type === "user") && row.value.trim().length > 0,
  );
}

export function hasEmailRecipients(recipients: ScheduleRecipient[]): boolean {
  return recipients.some((row) => row.type === "email" && isValidRecipient(row));
}

export function isScheduleFormSubmittable(form: ScheduleDeliveryForm): boolean {
  return getScheduleFormValidation(form).ok;
}

export function getScheduleFormValidation(form: ScheduleDeliveryForm): { ok: boolean; message: string | null } {
  const platformOk = hasPlatformRecipients(form.recipients);
  const emailOk = hasEmailRecipients(form.recipients);

  if (!emailOk && !platformOk) {
    return { ok: false, message: "请填写至少一个有效邮箱，或选择平台用户/角色" };
  }

  return { ok: true, message: null };
}
