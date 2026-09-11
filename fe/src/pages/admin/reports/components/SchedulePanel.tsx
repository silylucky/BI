import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CalendarClock, History, Plus } from "lucide-react";
import { toast } from "sonner";import { randomId } from "@/lib/randomId";
import { Button } from "@/components/ui/button";
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
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { summarizeRecipients } from "@/lib/scheduleSourceMeta";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { pickActiveSchedule, scheduleRowToForm, deliveryPayloadFromForm } from "../scheduleFormUtils";
import { describeCron } from "./ScheduleWizard";
import {
  DEFAULT_SCHEDULE_FORM,
  isScheduleFormSubmittable,
  resolveScheduleCron,
  ScheduleFormFields,
  type ScheduleFormValue,
} from "./ScheduleFormFields";
import { ScheduleActivationBanner } from "./ScheduleActivationBanner";
import { ScheduleHistoryTable } from "./ScheduleHistoryTable";
import { TemplatePanelSection, TemplateTabShell } from "./templatePanelUi";
import {
  localizeScheduleStatus,
  SCHEDULE_ACTION_LABELS,
  type ReportScheduleRow,
  type ScheduleExecutionRow,
} from "../useReportSchedules";
import {
  resolveActivationBannerSchedule,
  syncPendingActivationId,
} from "../scheduleActivationUi";

type ConfirmState =
  | { kind: "clone" }
  | { kind: "action"; action: string }
  | null;

const ACTION_SUCCESS_MESSAGES: Record<string, string> = {
  schedule: "调度已激活",
  pause: "调度已暂停",
  resume: "调度已恢复",
  cancel: "调度已取消",
};

export function SchedulePanel({ catalogNodeId, readOnly }: { catalogNodeId: string; readOnly: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ScheduleFormValue>(DEFAULT_SCHEDULE_FORM);
  const [clonePending, setClonePending] = useState(false);
  const [pendingActivateId, setPendingActivateId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const listQuery = useQuery({
    queryKey: ["reports", "schedules", catalogNodeId],
    queryFn: () =>
      apiFetch<{ items: ReportScheduleRow[]; total: number }>(
        `/api/v1/reports/schedules?catalogNodeId=${encodeURIComponent(catalogNodeId)}`,
      ),
  });

  const schedules = listQuery.data?.items ?? [];
  const schedule = pickActiveSchedule(schedules);
  const draftSelected = schedule?.status === "draft";

  useEffect(() => {
    setPendingActivateId((current) => syncPendingActivationId(schedules, current));
  }, [schedules]);

  useEffect(() => {
    if (schedule && draftSelected) {
      setForm(scheduleRowToForm(schedule));
    }
  }, [schedule?.id, draftSelected, schedule]);

  const historyQuery = useQuery({
    queryKey: ["reports", "schedule-executions", schedule?.id],
    queryFn: () =>
      apiFetch<{ items: ScheduleExecutionRow[]; total: number }>(
        `/api/v1/reports/schedules/${schedule!.id}/executions`,
      ),
    enabled: Boolean(schedule?.id),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["reports", "schedules", catalogNodeId] });
    if (schedule?.id) {
      void qc.invalidateQueries({ queryKey: ["reports", "schedule-executions", schedule.id] });
    }
  };

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<ReportScheduleRow>("/api/v1/reports/schedules", {
        method: "POST",
        body: JSON.stringify({
          catalogNodeId,
          cron: resolveScheduleCron(form),
          timezone: form.timezone,
          recipients: form.recipients.filter((r) => r.value.trim()),
          attachmentFormats: form.attachmentFormats,
          ...deliveryPayloadFromForm(form),
          emailSmtpSlot: form.emailSmtpSlot,
        }),
      }),
    onSuccess: (created) => {
      toast.success("调度已创建");
      if (created.allowedActions.includes("schedule")) {
        setPendingActivateId(created.id);
      }
      invalidate();
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      apiFetch<ReportScheduleRow>(`/api/v1/reports/schedules/${schedule!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          cron: resolveScheduleCron(form),
          timezone: form.timezone,
          recipients: form.recipients.filter((r) => r.value.trim()),
          attachmentFormats: form.attachmentFormats,
          ...deliveryPayloadFromForm(form),
          emailSmtpSlot: form.emailSmtpSlot,
        }),
      }),
    onSuccess: () => {
      toast.success("草稿已保存");
      invalidate();
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      apiFetch<ReportScheduleRow>(`/api/v1/reports/schedules/${id}/transition`, {
        method: "POST",
        body: JSON.stringify({ action }),
      }),
    onSuccess: (_data, vars) => {
      if (vars.action === "schedule") {
        setPendingActivateId(null);
      }
      toast.success(ACTION_SUCCESS_MESSAGES[vars.action] ?? "状态已更新");
      invalidate();
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const executeMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/reports/schedules/${id}/execute`, {
        method: "POST",
        headers: {
          "Idempotency-Key": randomId(),
          "X-Rpt-Semi-Real": "1",
        },
      }),
    onSuccess: () => {
      toast.success("已触发试发，请查收邮箱");
      invalidate();
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const retryMutation = useMutation({
    mutationFn: (executionId: string) =>
      apiFetch(`/api/v1/reports/schedules/executions/${executionId}/retry`, {
        method: "POST",
        headers: { "Idempotency-Key": randomId() },
      }),
    onSuccess: () => {
      toast.success("已提交重试");
      invalidate();
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const handleCreate = () => {
    if (!isScheduleFormSubmittable(form)) {
      toast.error("请配置至少一位有效接收人");
      return;
    }
    createMutation.mutate();
  };

  const handleSaveDraft = () => {
    if (!schedule || schedule.status !== "draft") return;
    updateMutation.mutate();
  };

  const runCloneConfig = async () => {
    if (!schedule || readOnly) return;
    setClonePending(true);
    try {
      const cloned = scheduleRowToForm(schedule);
      if (schedule.allowedActions.includes("cancel")) {
        await transitionMutation.mutateAsync({ id: schedule.id, action: "cancel" });
      }
      setForm(cloned);
      toast.success("已复制配置，请编辑后创建新调度");
    } catch (err) {
      toast.error(mapApiError(err));
    } finally {
      setClonePending(false);
    }
  };

  const runTransition = (action: string) => {
    if (!schedule) return;
    void transitionMutation.mutateAsync({ id: schedule.id, action });
  };

  const activationBannerSchedule = resolveActivationBannerSchedule(schedules, pendingActivateId);
  const activationBanner = activationBannerSchedule ? (
    <ScheduleActivationBanner
      onActivate={() => void transitionMutation.mutateAsync({ id: activationBannerSchedule.id, action: "schedule" })}
      activating={transitionMutation.isPending}
    />
  ) : null;

  if (listQuery.isError) {
    return (
      <PageErrorBanner message={mapApiError(listQuery.error)} onRetry={() => void listQuery.refetch()} />
    );
  }

  if (listQuery.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!schedule) {
    return (
      <TemplateTabShell>
        <TemplatePanelSection
          title="新建调度"
          description="配置定时发送频率、接收人与附件格式，创建后需激活方可执行。"
          icon={Plus}
          footer={
            !readOnly ? (
              <Button
                type="button"
                variant="primary"
                className="h-11"
                disabled={createMutation.isPending || !isScheduleFormSubmittable(form)}
                onClick={handleCreate}
              >
                {createMutation.isPending ? "创建中…" : "创建调度"}
              </Button>
            ) : undefined
          }
        >
          {activationBanner}
          <ScheduleFormFields
            value={form}
            onChange={setForm}
            disabled={readOnly}
            showAttachments
            idPrefix="template-schedule"
          />
        </TemplatePanelSection>
      </TemplateTabShell>
    );
  }

  return (
    <>
      <TemplateTabShell className="lg:grid lg:grid-cols-2 lg:items-start">
        <TemplatePanelSection
          title="调度配置"
          description={
            draftSelected
              ? "编辑草稿后保存，激活后将按计划执行。"
              : "已激活的调度无法直接修改，可复制配置新建或取消后重建。"
          }
          icon={CalendarClock}
          footer={
            <div className="flex flex-wrap gap-2">
              {schedule.status !== "draft" && !readOnly ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={clonePending || transitionMutation.isPending}
                  onClick={() => setConfirmState({ kind: "clone" })}
                >
                  {clonePending ? "处理中…" : "复制配置新建"}
                </Button>
              ) : null}
              {schedule.allowedActions.map((action) => (
                <Button
                  key={action}
                  type="button"
                  variant={action === "schedule" || action === "resume" ? "primary" : "outline"}
                  size="sm"
                  disabled={readOnly || transitionMutation.isPending}
                  onClick={() => {
                    if (action === "cancel" || action === "pause") {
                      setConfirmState({ kind: "action", action });
                      return;
                    }
                    runTransition(action);
                  }}
                >
                  {SCHEDULE_ACTION_LABELS[action] ?? action}
                </Button>
              ))}
              {!readOnly && schedule.status === "scheduled" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={executeMutation.isPending}
                  onClick={() => executeMutation.mutate(schedule.id)}
                  aria-label="立即试发定时报告"
                >
                  {executeMutation.isPending ? "试发中…" : "立即试发"}
                </Button>
              ) : null}
            </div>
          }
        >
          {activationBanner}
          {draftSelected ? (
            <>
              <ScheduleFormFields
                value={form}
                onChange={setForm}
                disabled={readOnly}
                showAttachments
                idPrefix="template-schedule-edit"
              />
              {!readOnly ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  disabled={updateMutation.isPending}
                  onClick={handleSaveDraft}
                >
                  {updateMutation.isPending ? "保存中…" : "保存草稿"}
                </Button>
              ) : null}
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-theme-sm text-gray-700 dark:text-gray-300">
                {describeCron(schedule.cron)} · {localizeScheduleStatus(schedule.status)}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                接收人：{summarizeRecipients(schedule.recipients)}
              </p>
            </div>
          )}
        </TemplatePanelSection>

        <TemplatePanelSection
          title="执行历史"
          description="查看近期发送记录，失败项可重试。"
          icon={History}
        >
          {historyQuery.isLoading ? <Skeleton className="h-32 w-full rounded-xl" /> : null}
          {!historyQuery.isLoading ? (
            <ScheduleHistoryTable
              rows={historyQuery.data?.items ?? []}
              readOnly={readOnly}
              retryPending={retryMutation.isPending}
              retryPendingExecutionId={retryMutation.variables}
              onRetry={(executionId) => retryMutation.mutate(executionId)}
            />
          ) : null}
        </TemplatePanelSection>
      </TemplateTabShell>

      <AlertDialog open={confirmState?.kind === "clone"} onOpenChange={(open) => !open && setConfirmState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>复制配置新建？</AlertDialogTitle>
            <AlertDialogDescription>
              将取消当前调度并复制其配置到新建表单。原调度停止后需重新激活新调度。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="primary"
              onClick={() => {
                setConfirmState(null);
                void runCloneConfig();
              }}
            >
              继续复制
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmState?.kind === "action"}
        onOpenChange={(open) => !open && setConfirmState(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmState?.kind === "action" && confirmState.action === "cancel"
                ? "取消调度？"
                : "暂停调度？"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState?.kind === "action" && confirmState.action === "cancel"
                ? "取消后该调度将不再执行，需重新创建才能恢复。"
                : "暂停后将停止按计划执行，可随时恢复。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const action = confirmState?.kind === "action" ? confirmState.action : null;
                setConfirmState(null);
                if (action) runTransition(action);
              }}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
