export type EmailSmtpSlot = "qq" | "163";

export const EMAIL_SMTP_SLOTS: { slot: EmailSmtpSlot; label: string; host: string; port: number }[] = [
  { slot: "qq", label: "QQ 邮箱", host: "smtp.qq.com", port: 587 },
  { slot: "163", label: "163 邮箱", host: "smtp.163.com", port: 465 },
];

export const DEFAULT_EMAIL_SMTP_SLOT: EmailSmtpSlot = "qq";

export function emailSmtpSlotLabel(slot: EmailSmtpSlot): string {
  return EMAIL_SMTP_SLOTS.find((item) => item.slot === slot)?.label ?? slot;
}
