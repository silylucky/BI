import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Clock, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { scheduleRowToForm, deliveryPayloadFromForm } from "../scheduleFormUtils";
import {
  localizeScheduleStatus,
  SCHEDULE_ACTION_LABELS,
  useReportScheduleMutations,
  useReportSchedulesList,
  useScheduleExecutions,
  type ReportScheduleRow,
} from "../useReportSchedules";
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
import { isLayoutInventoryArtifact } from "@/lib/scheduleArtifactMeta";
import { ScheduleArtifactNotice } from "./ScheduleArtifactNotice";
import { ScheduleHistoryTable } from "./ScheduleHistoryTable";
import { ScheduleActivationBanner } from "./ScheduleActivationBanner";
import { SchedulePrecheckPanel, useSchedulePrecheckItems, canCreateDashboardSchedule } from "./SchedulePrecheckPanel";
import {
  ScheduleActionBar,
  ScheduleFormSection,
  ScheduleSwitcher,
} from "./scheduleDialogUi";
import {
  resolveActivationBannerSchedule,
  syncPendingActivationId,
} from "../scheduleActivationUi";

type ConfirmState =
  | { kind: "delivery"; onConfirm: () => void }
  | { kind: "clone"; schedule: ReportScheduleRow }
  | { kind: "action"; action: string; scheduleId: string }
  | null;

const ACTION_SUCCESS_MESSAGES: Record<string, string> = {
  schedule: "定时报告已激活，将按配置时间发送",
  pause: "定时报告已暂停",
  resume: "定时报告已恢复",
  cancel: "定时报告已取消",
};

type DashboardSchedulePanelProps = {
  sourceId: string;
  sourceType: "dashboard" | "data_screen";
  sourceName: string;
  widgetCount?: number;
  readOnly?: boolean;
  embedded?: boolean;
  /** 嵌入弹窗打开时为 true，触发预检刷新 */
  precheckActive?: boolean;
};

export function DashboardSchedulePanel({
  sourceId,
  sourceType,
  sourceName,
  widgetCount,
  readOnly = false,
  embedded = false,
  precheckActive = false,
}: DashboardSchedulePanelProps) {
  const filter = { sourceId, sourceType };
  const listQuery = useReportSchedulesList(filter);
  const schedules = (listQuery.data?.items ?? []).filter((s) => s.status !== "cancelled");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = schedules.find((s) => s.id === selectedId) ?? schedules[0] ?? null;
  const draftSelected = selected?.status === "draft";

  useEffect(() => {
    if (selected && schedules.some((s) => s.id === selected.id)) return;
    setSelectedId(schedules[0]?.id ?? null);
  }, [schedules, selected]);

  const historyQuery = useScheduleExecutions(selected?.id ?? null);
  const { createSchedule, updateSchedule, transitionSchedule, executeSchedule, retryExecution } =
    useReportScheduleMutations(filter);

  const [form, setForm] = useState<ScheduleFormValue>({
    ...DEFAULT_SCHEDULE_FORM,
    recipients: DEFAULT_RECIPIENTS,
    attachmentFormats: ["pdf"],
    deliveryChannels: ["email"],
  });
  const [showCreate, setShowCreate] = useState(false);
  const [pendingActivateId, setPendingActivateId] = useState<string | null>(null);
  const [clonePending, setClonePending] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  useEffect(() => {
    setPendingActivateId((current) => syncPendingActivationId(schedules, current));
  }, [schedules]);

  useEffect(() => {
    if (selected && draftSelected) {
      const next = scheduleRowToForm(selected);
      setForm({
        ...next,
        attachmentFormats: ["pdf"],
        recipients: next.recipients,
      });
    }
  }, [selected?.id, draftSelected, selected]);

  const label = sourceType === "data_screen" ? "大屏" : "看板";
  const precheck = useSchedulePrecheckItems({
    sourceLabel: sourceName,
    widgetCount,
    requireVisualExport: true,
    emailSmtpSlot: form.emailSmtpSlot,
  });
  const canCreate = canCreateDashboardSchedule({
    widgetCount,
    exportStatus: precheck.items.find((i) => i.id === "export")?.ok ? "available" : "unavailable",
    loading: precheck.loading,
  }) && isScheduleFormSubmittable(form);
  const isPending =
    createSchedule.isPending ||
    updateSchedule.isPending ||
    transitionSchedule.isPending ||
    executeSchedule.isPending ||
    clonePending;

  const deliveryWarning =
    precheck.items.find((item) => item.id === "delivery" && !item.ok)?.detail ?? null;

  const formValidation = getScheduleFormValidation(form);
  const createBlockedReason = !canCreate
    ? precheck.items.find((item) => item.blocking && !item.ok)?.detail ??
      (!formValidation.ok ? formValidation.message ?? "请完善投递配置" : "前置检查未通过")
    : null;

  const requestDeliveryConfirm = (onConfirm: () => void) => {
    if (!deliveryWarning) {
      onConfirm();
      return;
    }
    setConfirmState({ kind: "delivery", onConfirm });
  };

  const handleCreate = async () => {
    if (!formValidation.ok) {
      toast.error(formValidation.message ?? "请完善投递配置");
      return;
    }
    if (!canCreate) {
      const blocked = precheck.items.find((item) => item.blocking && !item.ok);
      toast.error(blocked?.detail ?? "前置检查未通过，请修复后再创建");
      return;
    }
    try {
      const created = await createSchedule.mutateAsync({
        sourceType,
        sourceId,
        cron: resolveScheduleCron(form),
        timezone: form.timezone,
        recipients: form.recipients.filter((r) => r.value.trim()),
        attachmentFormats: ["pdf"],
        ...deliveryPayloadFromForm(form),
        emailSmtpSlot: form.emailSmtpSlot,
      });
      setShowCreate(false);
      setSelectedId(created.id);
      if (created.allowedActions.includes("schedule") && !embedded) {
        setPendingActivateId(created.id);
      }
      toast.success("定时报告已创建");
    } catch (err) {
      toast.error(mapApiError(err));
    }
  };

  const handleSaveDraft = async () => {
    if (!selected || selected.status !== "draft") return;
    try {
      await updateSchedule.mutateAsync({
        id: selected.id,
        body: {
          cron: resolveScheduleCron(form),
          timezone: form.timezone,
          recipients: form.recipients.filter((r) => r.value.trim()),
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
      toast.success(ACTION_SUCCESS_MESSAGES.schedule);
    } catch (err) {
      toast.error(mapApiError(err));
    }
  };

  const handleCloneConfig = async (schedule: ReportScheduleRow) => {
    if (readOnly) return;
    setClonePending(true);
    try {
      const cloned = scheduleRowToForm(schedule);
      if (schedule.allowedActions.includes("cancel")) {
        await transitionSchedule.mutateAsync({ id: schedule.id, action: "cancel" });
      }
      setForm({ ...cloned, attachmentFormats: ["pdf"] });
      setShowCreate(true);
      setSelectedId(null);
      toast.success("已复制配置，请编辑后创建新定时报告");
    } catch (err) {
      toast.error(mapApiError(err));
    } finally {
      setClonePending(false);
    }
  };

  const handleTestSend = async (scheduleId: string) => {
    try {
      await executeSchedule.mutateAsync(scheduleId);
      toast.success("已触发试发，请按所选通道查收");
    } catch (err) {
      toast.error(mapApiError(err));
    }
  };

  if (listQuery.isError) {
    return (
      <PageErrorBanner message={mapApiError(listQuery.error)} onRetry={() => void listQuery.refetch()} />
    );
  }

  if (listQuery.isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  const history = historyQuery.data?.items ?? [];
  const showLegacyNotice = history.some((row) => isLayoutInventoryArtifact(row.artifactKind));

  const formFieldProps = {
    showAttachments: true as const,
    attachmentFormatMode: "pdf-only" as const,
    hideStandaloneHealthAlerts: true as const,
    embeddedLayout: embedded,
    showDeliveryChannels: true,
  };

  const activationBannerSchedule = resolveActivationBannerSchedule(
    schedules,
    pendingActivateId,
    { embedded },
  );

  const inner = (
    <div className={embedded ? "space-y-4" : "space-y-4"}>
      <ScheduleArtifactNotice show={showLegacyNotice} />
      {readOnly ? (
        <p className="text-theme-sm text-gray-500">
          您没有管理定时报告的权限。请联系管理员开通「看板定时推送」或「报表管理」权限。
        </p>
      ) : null}
      {activationBannerSchedule ? (
        <ScheduleActivationBanner
          onActivate={() =>
            requestDeliveryConfirm(() => void handleActivate(activationBannerSchedule.id))
          }
          activating={transitionSchedule.isPending}
          disabled={readOnly}
          deliveryWarning={deliveryWarning}
        />
      ) : null}
      {schedules.length > 0 ? (
        embedded ? (
          <ScheduleSwitcher
            schedules={schedules}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            onCreate={() => setShowCreate(true)}
            readOnly={readOnly}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {schedules.map((s) => (
              <Button
                key={s.id}
                type="button"
                variant={selected?.id === s.id ? "primary" : "outline"}
                size="sm"
                onClick={() => setSelectedId(s.id)}
              >
                {s.name || describeCron(s.cron)} · {localizeScheduleStatus(s.status)}
              </Button>
            ))}
            {!readOnly ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(true)}>
                + 新建
              </Button>
            ) : null}
          </div>
        )
      ) : null}
      {showCreate || schedules.length === 0 ? (
        <>
          {!readOnly ? (
            <SchedulePrecheckPanel
              sourceLabel={sourceName}
              widgetCount={widgetCount}
              active={precheckActive}
              emailSmtpSlot={form.emailSmtpSlot}
            />
          ) : null}
          <ScheduleFormFields
            value={form}
            onChange={setForm}
            disabled={readOnly}
            {...formFieldProps}
            idPrefix="dash-schedule"
          />
          {!readOnly ? (
            embedded ? (
              <ScheduleActionBar
                hint={createBlockedReason ?? "配置完成后创建草稿，再激活即可按计划投递。"}
              >
                <Button
                  type="button"
                  variant="primary"
                  disabled={isPending || !canCreate}
                  onClick={() => void handleCreate()}
                >
                  {createSchedule.isPending ? "创建中…" : "创建定时报告"}
                </Button>
                {schedules.length > 0 ? (
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                    取消
                  </Button>
                ) : null}
              </ScheduleActionBar>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    disabled={isPending || !canCreate}
                    onClick={() => void handleCreate()}
                  >
                    {createSchedule.isPending ? "创建中…" : "创建定时报告"}
                  </Button>
                  {schedules.length > 0 ? (
                    <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                      取消
                    </Button>
                  ) : null}
                </div>
                {createBlockedReason ? (
                  <p className="text-theme-xs text-amber-600 dark:text-amber-400">{createBlockedReason}</p>
                ) : null}
              </div>
            )
          ) : null}
        </>
      ) : selected ? (
        embedded ? (
          <div className="space-y-4">
            {draftSelected ? (
              <ScheduleFormFields
                value={form}
                onChange={setForm}
                disabled={readOnly}
                {...formFieldProps}
                idPrefix="dash-schedule-edit"
              />
            ) : (
              <ScheduleFormSection title="当前配置" description="已激活的定时任务仅支持复制或取消后重建" icon={Clock}>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-theme-xs text-gray-500 dark:text-gray-400">执行计划</dt>
                    <dd className="mt-1 text-theme-sm font-medium text-gray-900 dark:text-white">
                      {describeCron(selected.cron)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-theme-xs text-gray-500 dark:text-gray-400">状态</dt>
                    <dd className="mt-1 text-theme-sm font-medium text-gray-900 dark:text-white">
                      {localizeScheduleStatus(selected.status)}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-theme-xs text-gray-500 dark:text-gray-400">接收人</dt>
                    <dd className="mt-1 text-theme-sm text-gray-700 dark:text-gray-300">
                      {summarizeRecipients(selected.recipients)}
                    </dd>
                  </div>
                </dl>
              </ScheduleFormSection>
            )}
            {!readOnly ? (
              <ScheduleActionBar
                hint={
                  draftSelected
                    ? "保存草稿后可激活；激活后将按配置时间自动生成并投递 PDF。"
                    : "已激活任务无法直接修改配置，可复制后新建。"
                }
              >
                {draftSelected ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => void handleSaveDraft()}
                  >
                    {updateSchedule.isPending ? "保存中…" : "保存草稿"}
                  </Button>
                ) : null}
                {selected.status !== "draft" && !readOnly ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => setConfirmState({ kind: "clone", schedule: selected })}
                  >
                    {clonePending ? "处理中…" : "复制配置新建"}
                  </Button>
                ) : null}
                {selected.allowedActions.map((action) => (
                  <Button
                    key={action}
                    type="button"
                    variant={action === "schedule" || action === "resume" ? "primary" : "outline"}
                    size="sm"
                    disabled={readOnly || transitionSchedule.isPending}
                    onClick={() => {
                      if (action === "cancel" || action === "pause") {
                        setConfirmState({ kind: "action", action, scheduleId: selected.id });
                        return;
                      }
                      if (action === "schedule" || action === "resume") {
                        if (action === "schedule") {
                          requestDeliveryConfirm(() => void handleActivate(selected.id));
                          return;
                        }
                        requestDeliveryConfirm(() =>
                          void transitionSchedule
                            .mutateAsync({ id: selected.id, action })
                            .then(() => toast.success(ACTION_SUCCESS_MESSAGES[action] ?? "状态已更新"))
                            .catch((err) => toast.error(mapApiError(err))),
                        );
                        return;
                      }
                      void transitionSchedule
                        .mutateAsync({ id: selected.id, action })
                        .then(() => toast.success(ACTION_SUCCESS_MESSAGES[action] ?? "状态已更新"))
                        .catch((err) => toast.error(mapApiError(err)));
                    }}
                  >
                    {SCHEDULE_ACTION_LABELS[action] ?? action}
                  </Button>
                ))}
                {!readOnly && selected.status === "scheduled" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={executeSchedule.isPending}
                    onClick={() => requestDeliveryConfirm(() => void handleTestSend(selected.id))}
                  >
                    {executeSchedule.isPending ? "试发中…" : "立即试发"}
                  </Button>
                ) : null}
              </ScheduleActionBar>
            ) : null}
            <ScheduleFormSection
              title="执行历史"
              description="最近投递记录与失败重试"
              icon={History}
            >
              {historyQuery.isLoading ? <Skeleton className="h-24 w-full rounded-lg" /> : null}
              {!historyQuery.isLoading ? (
                <ScheduleHistoryTable
                  rows={history}
                  compact
                  embedded
                  readOnly={readOnly}
                  retryPending={retryExecution.isPending}
                  retryPendingExecutionId={
                    retryExecution.isPending ? retryExecution.variables?.executionId : undefined
                  }
                  onRetry={(executionId) =>
                    void retryExecution
                      .mutateAsync({ executionId, scheduleId: selected.id })
                      .then(() => toast.success("已提交重试"))
                      .catch((err) => toast.error(mapApiError(err)))
                  }
                />
              ) : null}
            </ScheduleFormSection>
          </div>
        ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {draftSelected ? (
              <>
                <ScheduleFormFields
                  value={form}
                  onChange={setForm}
                  disabled={readOnly}
                  {...formFieldProps}
                  idPrefix="dash-schedule-edit"
                />
                {!readOnly ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => void handleSaveDraft()}
                  >
                    {updateSchedule.isPending ? "保存中…" : "保存草稿"}
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <p className="text-theme-sm text-gray-600 dark:text-gray-400">
                  {describeCron(selected.cron)} · {localizeScheduleStatus(selected.status)}
                </p>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  接收人：{summarizeRecipients(selected.recipients)}
                </p>
                {!readOnly ? (
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                    已激活后无法直接修改。可「复制配置新建」或先「取消」后重建。
                  </p>
                ) : null}
              </>
            )}
            <div className="flex flex-wrap gap-2">
              {selected.status !== "draft" && !readOnly ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setConfirmState({ kind: "clone", schedule: selected })}
                >
                  {clonePending ? "处理中…" : "复制配置新建"}
                </Button>
              ) : null}
              {selected.allowedActions.map((action) => (
                <Button
                  key={action}
                  type="button"
                  variant={action === "schedule" || action === "resume" ? "primary" : "outline"}
                  size="sm"
                  disabled={readOnly || transitionSchedule.isPending}
                  onClick={() => {
                    if (action === "cancel" || action === "pause") {
                      setConfirmState({ kind: "action", action, scheduleId: selected.id });
                      return;
                    }
                    if (action === "schedule" || action === "resume") {
                      if (action === "schedule") {
                        requestDeliveryConfirm(() => void handleActivate(selected.id));
                        return;
                      }
                      requestDeliveryConfirm(() =>
                        void transitionSchedule
                          .mutateAsync({ id: selected.id, action })
                          .then(() => toast.success(ACTION_SUCCESS_MESSAGES[action] ?? "状态已更新"))
                          .catch((err) => toast.error(mapApiError(err))),
                      );
                      return;
                    }
                    void transitionSchedule
                      .mutateAsync({ id: selected.id, action })
                      .then(() => toast.success(ACTION_SUCCESS_MESSAGES[action] ?? "状态已更新"))
                      .catch((err) => toast.error(mapApiError(err)));
                  }}
                >
                  {SCHEDULE_ACTION_LABELS[action] ?? action}
                </Button>
              ))}
              {!readOnly && selected.status === "scheduled" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={executeSchedule.isPending}
                  onClick={() => requestDeliveryConfirm(() => void handleTestSend(selected.id))}
                >
                  {executeSchedule.isPending ? "试发中…" : "立即试发"}
                </Button>
              ) : null}
            </div>
          </div>
          <div>
            {historyQuery.isLoading ? <Skeleton className="h-24 w-full" /> : null}
            {!historyQuery.isLoading ? (
              <ScheduleHistoryTable
                rows={history}
                compact
                readOnly={readOnly}
                retryPending={retryExecution.isPending}
                retryPendingExecutionId={
                  retryExecution.isPending ? retryExecution.variables?.executionId : undefined
                }
                onRetry={(executionId) =>
                  void retryExecution
                    .mutateAsync({ executionId, scheduleId: selected.id })
                    .then(() => toast.success("已提交重试"))
                    .catch((err) => toast.error(mapApiError(err)))
                }
              />
            ) : null}
          </div>
        </div>
        )
      ) : null}
    </div>
  );

  const confirmDialogs = (
    <>
      <AlertDialog
        open={confirmState?.kind === "delivery"}
        onOpenChange={(open) => !open && setConfirmState(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>邮件投递可能失败</AlertDialogTitle>
            <AlertDialogDescription>
              {deliveryWarning}
              {" "}
              仍要继续吗？激活或试发后邮件可能无法送达。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="primary"
              onClick={() => {
                const action = confirmState?.kind === "delivery" ? confirmState.onConfirm : null;
                setConfirmState(null);
                action?.();
              }}
            >
              仍要继续
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmState?.kind === "clone"} onOpenChange={(open) => !open && setConfirmState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>复制配置新建？</AlertDialogTitle>
            <AlertDialogDescription>
              将取消当前定时报告并复制其配置到新建表单。原报告停止后需重新激活新报告。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="primary"
              onClick={() => {
                const schedule = confirmState?.kind === "clone" ? confirmState.schedule : null;
                setConfirmState(null);
                if (schedule) void handleCloneConfig(schedule);
              }}
            >
              继续复制
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmState?.kind === "action"} onOpenChange={(open) => !open && setConfirmState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmState?.kind === "action" && confirmState.action === "cancel"
                ? "取消定时报告？"
                : "暂停定时报告？"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState?.kind === "action" && confirmState.action === "cancel"
                ? "取消后该报告将不再执行，需重新创建才能恢复。"
                : "暂停后将停止按计划执行，可随时恢复。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmState?.kind !== "action") return;
                const { action, scheduleId } = confirmState;
                setConfirmState(null);
                void transitionSchedule
                  .mutateAsync({ id: scheduleId, action })
                  .then(() => toast.success(ACTION_SUCCESS_MESSAGES[action] ?? "状态已更新"))
                  .catch((err) => toast.error(mapApiError(err)));
              }}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (embedded) {
    return (
      <>
        {inner}
        {confirmDialogs}
      </>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-title-sm">
          <Clock className="size-4" aria-hidden />
          定时报告
        </CardTitle>
        <CardDescription>
          主路径：为「{sourceName}」{label}定时生成可视化 PDF 并投递。复用看板已保存的查询与筛选。
          <Link to="/admin/reports/schedules?tab=dashboard" className="ml-1 text-brand-500 hover:underline">
            查看全部定时报告
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {inner}
        {confirmDialogs}
      </CardContent>
    </Card>
  );
}
