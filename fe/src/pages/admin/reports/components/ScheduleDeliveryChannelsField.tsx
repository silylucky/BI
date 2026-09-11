import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EMAIL_SMTP_SLOTS,
  type EmailSmtpSlot,
} from "@/lib/emailSmtpSlots";

export type DeliveryChannel = "email";

type Props = {
  disabled?: boolean;
  deliveryChannels: DeliveryChannel[];
  onDeliveryChannelsChange: (channels: DeliveryChannel[]) => void;
  emailSmtpSlot: EmailSmtpSlot;
  onEmailSmtpSlotChange: (slot: EmailSmtpSlot) => void;
  embedded?: boolean;
  idPrefix?: string;
};

export function ScheduleDeliveryChannelsField({
  disabled,
  emailSmtpSlot,
  onEmailSmtpSlotChange,
  embedded = false,
  idPrefix = "schedule-email-smtp",
}: Props) {
  const slotField = (
    <div className="grid gap-1.5">
      <Label htmlFor={`${idPrefix}-slot`} className={embedded ? undefined : "text-theme-xs text-gray-500"}>
        发信通道
      </Label>
      <Select
        value={emailSmtpSlot}
        onValueChange={(value) => onEmailSmtpSlotChange(value as EmailSmtpSlot)}
        disabled={disabled}
      >
        <SelectTrigger
          id={`${idPrefix}-slot`}
          className={embedded ? "h-11 bg-white dark:bg-transparent" : "h-10 bg-white dark:bg-transparent"}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EMAIL_SMTP_SLOTS.map((item) => (
            <SelectItem key={item.slot} value={item.slot}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        使用系统管理 → 平台对接中对应槽位的 SMTP 发信。
      </p>
    </div>
  );

  if (embedded) {
    return <div className="space-y-4">{slotField}</div>;
  }

  return (
    <div className="grid gap-2">
      <Label>投递方式</Label>
      <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5 dark:border-gray-800 dark:bg-white/[0.02]">
        <p className="text-theme-sm text-gray-700 dark:text-gray-300">
          定时报告通过邮件发送到收件人邮箱。
        </p>
        {slotField}
      </div>
    </div>
  );
}
