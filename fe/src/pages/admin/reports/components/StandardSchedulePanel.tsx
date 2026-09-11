import { useEffect, useState } from "react";
import { Link } from "react-router";
import { CalendarClock, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { standardScheduleHubPath } from "../standardRoutes";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { mapApiError } from "@/lib/apiError";
import { summarizeRecipients } from "@/lib/scheduleSourceMeta";
import { pickActiveSchedule, scheduleRowToForm, deliveryPayloadFromForm } from "../scheduleFormUtils";
import { describeCron } from "./ScheduleWizard";
import {
  DEFAULT_SCHEDULE_FORM,
  getScheduleFormValidation,
  isScheduleFormSubmittable,
  resolveScheduleCron,
  ScheduleFormFields,
  type ScheduleFormValue,
} from "./ScheduleFormFields";
import { DEFAULT_RECIPIENTS } from "./ScheduleRecipientsField";
import { ScheduleActivationBanner } from "./ScheduleActivationBanner";
import { ScheduleDeliveryHealthAlert } from "./ScheduleDeliveryHealthAlert";
import { ScheduleHistoryTable } from "./ScheduleHistoryTable";
import { ScheduleFormSection } from "./scheduleDialogUi";
import {
  localizeScheduleStatus,
  SCHEDULE_ACTION_LABELS,
  useReportScheduleMutations,
  useReportSchedulesList,
  useScheduleExecutions,
} from "../useReportSchedules";
import {
  resolveActivationBannerSchedule,
  syncPendingActivationId,
} from "../scheduleActivationUi";

type Props = {
  sourceKey: string;
  packName: string;
  disabled?: boolean;
};

export function StandardSchedulePanel({ sourceKey, packName, disabled = false }: Props) {
  const filter = { sourceType: "standard", sourceKey };
  const listQuery = useReportSchedulesList(filter);
  const schedules = listQuery.data?.items ?? [];
  const schedule = pickActiveSchedule(schedules);
  const draftSelected = schedule?.status === "draft";
  const historyQuery = useScheduleExecutions(schedule?.id ?? null);
  const { createSchedule, updateSchedule, transitionSchedule, executeSchedule } =
    useReportScheduleMutations(filter);

  const [form, setForm] = useState<ScheduleFormValue>({
    ...DEFAULT_SCHEDULE_FORM,
    recipients: DEFAULT_RECIPIENTS,
    attachmentFormats: ["pdf"],
  });
  const [pendingActivateId, setPendingActivateId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  useEffect(() => {
    setPendingActivateId((current) => syncPendingActivationId(schedules, current));
  }, [schedules]);

  useEffect(() => {
    if (schedule && draftSelected) {
      const loaded = scheduleRowToForm(schedule);
      setForm({
        ...loaded,
        recipients: loaded.recipients,
        attachmentFormats: ["pdf"],
      });
    }
  }, [schedule?.id, draftSelected, schedule]);

  const handleCreate = async () => {
    const validation = getScheduleFormValidation(form);
    if (!validation.ok) {
      toast.error(validation.message ?? "请完善投递配置");
      return;
    }
    try {
      const created = await createSchedule.mutateAsync({
        sourceType: "standard",
        sourceKey,
        name: `${packName} 定时投递`,
        cron: resolveScheduleCron(form),
        timezone: form.timezone,
        recipients: form.recipients.filter((item) => item.value.trim()),
        attachmentFormats: ["pdf"],
        ...deliveryPayloadFromForm(form),
        emailSmtpSlot: form.emailSmtpSlot,
      });
      if (created.allowedActions.includes("schedule")) {
        setPendingActivateId(created.id);
      }
      toast.success("定时投递已创建");
    } catch (err) {
      toast.error(mapApiError(err));
    }
  };

  const handleSaveDraft = async () => {
    if (!schedule || schedule.status !== "draft") return;
    try {
      await updateSchedule.mutateAsync({
        id: schedule.id,
        body: {
          cron: resolveScheduleCron(form),
          timezone: form.timezone,
          recipients: form.recipients.filter((item) => item.value.trim()),
          attachmentFormats: ["pdf"],
          ...deliveryPayloadFromForm(form),
          emailSmtpSlot: form.emailSmtpSlot,
        },
      });
      toast.success("草稿已保存");
    } catch (err) {
      toast.error(mapApiError(err));
    }
  };

  const handleActivate = async (scheduleId: string) => {
    try {
      await transitionSchedule.mutateAsync({ id: scheduleId, action: "schedule" });
      setPendingActivateId(null);
      toast.success("定时投递已激活");
    } catch (err) {
      toast.error(mapApiError(err));
    }
  };

  const activationBannerSchedule = resolveActivationBannerSchedule(schedules, pendingActivateId);

  if (listQuery.isError) {
    return (
      <PageErrorBanner message={mapApiError(listQuery.error)} onRetry={() => void listQuery.refetch()} />
    );
  }

  if (listQuery.isLoading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  return (
    <div className="relative isolate space-y-4 border-t border-gray-200 pt-8 dark:border-gray-800">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white">定时投递</h3>
          <p className="mt-0.5 text-theme-xs leading-relaxed text-gray-500 dark:text-gray-400">
            按周期生成标准分析 PDF，并通过邮件投递。
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="shrink-0" asChild>
          <Link to={standardScheduleHubPath(sourceKey)}>在调度中心查看</Link>
        </Button>
      </div>

      {activationBannerSchedule ? (
        <ScheduleActivationBanner
          onActivate={() => void handleActivate(activationBannerSchedule.id)}
          activating={transitionSchedule.isPending}
        />
      ) : null}

      {!schedule ? (
        <ScheduleFormSection
          title="新建定时投递"
          description="配置执行频率与邮件投递；创建后需激活才会按计划发送。"
          icon={CalendarClock}
          footer={
            !disabled ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={createSchedule.isPending || !isScheduleFormSubmittable(form)}
                onClick={() => void handleCreate()}
              >
                {createSchedule.isPending ? "创建中…" : "创建定时投递"}
              </Button>
            ) : undefined
          }
        >
          {!disabled ? <ScheduleDeliveryHealthAlert /> : null}
          <ScheduleFormFields
            value={form}
            onChange={setForm}
            disabled={disabled}
            showAttachments={false}
            showDeliveryChannels
            hideStandaloneHealthAlerts
            embeddedLayout
            idPrefix={`std-schedule-${sourceKey}`}
          />
        </ScheduleFormSection>
      ) : (
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          <ScheduleFormSection
            title="投递配置"
            description={
              draftSelected
                ? "编辑草稿后保存，激活后将按计划执行。"
                : "已激活的投递无法直接修改，请取消后重建。"
            }
            icon={CalendarClock}
            footer={
              <div className="flex flex-wrap gap-2">
                {schedule.allowedActions.map((action) => (
                  <Button
                    key={action}
                    type="button"
                    variant={action === "schedule" || action === "resume" ? "primary" : "outline"}
                    size="sm"
                    disabled={disabled || transitionSchedule.isPending}
                    onClick={() => {
                      if (action === "cancel" || action === "pause") {
                        setConfirmAction(action);
                        return;
                      }
                      if (action === "schedule") {
                        void handleActivate(schedule.id);
                        return;
                      }
                      void transitionSchedule.mutateAsync({ id: schedule.id, action });
                    }}
                  >
                    {SCHEDULE_ACTION_LABELS[action] ?? action}
                  </Button>
                ))}
                {!disabled && schedule.status === "scheduled" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={executeSchedule.isPending}
                    onClick={() => void executeSchedule.mutateAsync(schedule.id)}
                  >
                    {executeSchedule.isPending ? "试发中…" : "立即试发"}
                  </Button>
                ) : null}
              </div>
            }
          >
            {draftSelected ? (
              <>
                {!disabled ? <ScheduleDeliveryHealthAlert /> : null}
                <ScheduleFormFields
                  value={form}
                  onChange={setForm}
                  disabled={disabled}
                  showAttachments={false}
                  showDeliveryChannels
                  hideStandaloneHealthAlerts
                  embeddedLayout
                  idPrefix={`std-schedule-edit-${sourceKey}`}
                />
                {!disabled ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={updateSchedule.isPending}
                    onClick={() => void handleSaveDraft()}
                  >
                    {updateSchedule.isPending ? "保存中…" : "保存草稿"}
                  </Button>
                ) : null}
              </>
            ) : (
              <div className="space-y-2 text-theme-sm text-gray-700 dark:text-gray-300">
                <p>
                  {describeCron(schedule.cron)} · {localizeScheduleStatus(schedule.status)}
                </p>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  接收人：{summarizeRecipients(schedule.recipients)}
                </p>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  投递方式：{(schedule.deliveryChannels ?? ["email"]).join("、")}
                </p>
              </div>
            )}
          </ScheduleFormSection>

          <ScheduleFormSection title="执行历史" description="最近一次试发或定时执行记录。" icon={History}>
            <ScheduleHistoryTable rows={historyQuery.data?.items ?? []} embedded compact />
          </ScheduleFormSection>
        </div>
      )}

      <AlertDialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认操作？</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "cancel" ? "取消后该定时投递将不再执行。" : "暂停后可恢复执行。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!schedule || !confirmAction) return;
                void transitionSchedule
                  .mutateAsync({ id: schedule.id, action: confirmAction })
                  .then(() => setConfirmAction(null));
              }}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
