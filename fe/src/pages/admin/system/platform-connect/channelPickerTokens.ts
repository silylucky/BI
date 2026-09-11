import type { EmailSmtpSlot } from "@/lib/emailSmtpSlots";
import { cn } from "@/lib/utils";

export type ChannelPickerToken = {
  label: string;
  iconIdle: string;
  iconActive: string;
  cardActive: string;
};

const PICKER_CARD_IDLE =
  "border-gray-200 bg-white hover:border-gray-300 hover:shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-gray-700";

export const EMAIL_SLOT_ICON: Record<EmailSmtpSlot, ChannelPickerToken> = {
  qq: {
    label: "QQ",
    iconIdle:
      "bg-sky-100 text-sky-700 ring-1 ring-sky-200/80 group-hover:bg-sky-200/90 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/25",
    iconActive: "bg-sky-500 text-white shadow-theme-xs",
    cardActive:
      "border-sky-300 bg-sky-50/60 shadow-theme-sm ring-1 ring-sky-500/15 dark:border-sky-500/35 dark:bg-sky-500/10",
  },
  "163": {
    label: "163",
    iconIdle:
      "bg-rose-100 text-rose-700 ring-1 ring-rose-200/80 group-hover:bg-rose-200/90 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/25",
    iconActive: "bg-rose-500 text-white shadow-theme-xs",
    cardActive:
      "border-rose-300 bg-rose-50/60 shadow-theme-sm ring-1 ring-rose-500/15 dark:border-rose-500/35 dark:bg-rose-500/10",
  },
};

export function channelPickerCardClass(token: ChannelPickerToken, active: boolean): string {
  return cn(
    "group flex w-full items-center justify-between gap-2 rounded-2xl border px-3 py-3 text-left transition",
    active ? token.cardActive : PICKER_CARD_IDLE,
  );
}

export function channelPickerIconClass(token: ChannelPickerToken, active: boolean): string {
  return cn(
    "flex size-10 shrink-0 items-center justify-center rounded-xl text-theme-sm font-semibold transition",
    active ? token.iconActive : token.iconIdle,
  );
}
