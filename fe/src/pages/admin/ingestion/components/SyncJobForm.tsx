import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router";
import {
  ArrowRightLeft,
  Clock3,
  Database,
  RefreshCw,
  Tag,
} from "lucide-react";
import {
  HUB_SEGMENTED_BUTTON_CLASS,
  HUB_SEGMENTED_SHELL_CLASS,
} from "@/components/dashboard/hubFilterUi";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  syncSourceObjectLabel,
  syncSourceObjectPlaceholder,
} from "@/lib/suggestSyncTargetTable";
import { SyncJobConsumeGuide } from "./SyncJobConsumeGuide";
import { SyncSourceTableSelect } from "./SyncSourceTableSelect";
import { SYNC_CONTROL_CLASS, SyncFormField } from "./SyncFormField";
import { CRON_PRESETS } from "./sync-job-types";
import { DIRTY_ORDERS_DEMO_SOURCE_TABLE } from "../etlDemoTemplate";

export const SYNC_JOB_FORM_ID = "sync-job-form";

export type SyncMode = "full" | "incremental";

export type DatasourceItem = {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  database: string;
};

export type LegacyInlineSource = {
  host: string;
  port: number;
  database: string;
  username: string;
};

export type JobFormState = {
  name: string;
  sourceDataSourceId: string;
  sourceSchema: string;
  table: string;
  target_table: string;
  syncMode: SyncMode;
  primaryKey: string;
  incrementalColumn: string;
  schedule_cron: string;
  enabled: boolean;
};

type SyncJobFormProps = {
  form: JobFormState;
  isEdit: boolean;
  etlRulesHref?: string;
  datasources: DatasourceItem[];
  selectedDatasource?: DatasourceItem;
  legacyInlineSource?: LegacyInlineSource | null;
  fieldErrors: Record<string, string>;
  conflictingJobNames?: string[];
  onSuggestTargetTable?: () => void;
  jobId?: string;
  justCreated?: boolean;
  hideConsumeGuide?: boolean;
  formId?: string;
  onChange: <K extends keyof JobFormState>(key: K, value: JobFormState[K]) => void;
  onSubmit: (event?: FormEvent) => void;
};

function FormSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: typeof Database;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-4 dark:border-gray-800 dark:bg-white/[0.02]">
        <div className="flex items-start gap-3">
          {Icon ? (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/30">
              <Icon className="size-4" aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0">
            <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
            {description ? (
              <p className="mt-1 text-theme-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="grid gap-4 px-5 py-5">{children}</div>
    </section>
  );
}

function SegmentedChoice<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(HUB_SEGMENTED_SHELL_CLASS, "inline-flex flex-wrap gap-0.5")}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={active ? "subtle" : "ghost"}
            className={HUB_SEGMENTED_BUTTON_CLASS}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

export function SyncJobForm({
  form,
  isEdit,
  etlRulesHref,
  datasources,
  selectedDatasource,
  legacyInlineSource = null,
  fieldErrors,
  conflictingJobNames = [],
  onSuggestTargetTable,
  jobId,
  justCreated = false,
  hideConsumeGuide = false,
  formId = SYNC_JOB_FORM_ID,
  onChange,
  onSubmit,
}: SyncJobFormProps) {
  const sourceHint =
    selectedDatasource?.type === "rest_api"
      ? "填写 API 路径，如 /sample-api/orders"
      : undefined;

  return (
    <form
      id={formId}
      className="mx-auto grid w-full max-w-3xl gap-5"
      onSubmit={(event) => onSubmit(event)}
    >
      {isEdit && form.target_table && !hideConsumeGuide && justCreated ? (
        <SyncJobConsumeGuide
          jobId={jobId}
          jobName={form.name.trim() || undefined}
          targetTable={form.target_table}
          syncMode={form.syncMode}
          variant="how_to"
          justCreated
        />
      ) : null}

      <FormSection title="基本信息" icon={Tag}>
        <SyncFormField label="任务名称" htmlFor="name">
          <Input
            id="name"
            className={SYNC_CONTROL_CLASS}
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            required
            placeholder="例如：订单表每日同步"
          />
        </SyncFormField>
      </FormSection>

      <FormSection title="业务源连接" description="选择连接管理中已登记的数据源。" icon={Database}>
        {legacyInlineSource ? (
          <Alert severity="warning" className="rounded-xl">
            <AlertTitle>仍使用旧版内联连接</AlertTitle>
            <AlertDescription className="text-theme-xs">
              快照
              <span className="font-mono">
                {" "}
                {legacyInlineSource.username}@{legacyInlineSource.host}:{legacyInlineSource.port}/
                {legacyInlineSource.database}
              </span>
              。请选择对应连接后保存以完成迁移。
            </AlertDescription>
          </Alert>
        ) : null}

        {datasources.length === 0 ? (
          <Alert severity="warning" className="rounded-xl">
            <AlertTitle>尚无可用连接</AlertTitle>
            <AlertDescription className="text-theme-xs">
              请先在
              <Link
                to="/admin/datasources/new"
                className="text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
              >
                连接管理
              </Link>
              登记数据源。
            </AlertDescription>
          </Alert>
        ) : (
          <SyncFormField
            label="业务源连接"
            htmlFor="datasource"
            hint={
              selectedDatasource
                ? `${selectedDatasource.host}:${selectedDatasource.port}/${selectedDatasource.database}`
                : undefined
            }
          >
            <Select
              value={form.sourceDataSourceId || undefined}
              onValueChange={(value) => onChange("sourceDataSourceId", value)}
            >
              <SelectTrigger id="datasource" className={SYNC_CONTROL_CLASS} aria-label="业务源连接">
                <SelectValue placeholder="选择已登记的业务源连接" />
              </SelectTrigger>
              <SelectContent>
                {datasources.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SyncFormField>
        )}
      </FormSection>

      <FormSection title="同步目标" description="源对象写入托管分析库目标表，一表一任务。" icon={ArrowRightLeft}>
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          <SyncSourceTableSelect
            id="table"
            label={syncSourceObjectLabel(selectedDatasource?.type)}
            placeholder={syncSourceObjectPlaceholder(selectedDatasource?.type)}
            hint={sourceHint}
            dataSourceId={form.sourceDataSourceId}
            sourceType={selectedDatasource?.type}
            database={selectedDatasource?.database}
            sourceSchema={form.sourceSchema}
            onSourceSchemaChange={(value) => onChange("sourceSchema", value)}
            value={form.table}
            onChange={(value) => onChange("table", value)}
          />
          <SyncFormField
            label="目标表"
            htmlFor="target_table"
            hint="全量同步会覆盖分析库中同名表。"
            action={
              onSuggestTargetTable ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-theme-xs text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
                  onClick={onSuggestTargetTable}
                >
                  重新建议
                </Button>
              ) : undefined
            }
          >
            <Input
              id="target_table"
              className={SYNC_CONTROL_CLASS}
              value={form.target_table}
              onChange={(e) => onChange("target_table", e.target.value)}
              required
              placeholder="orders_clean"
            />
          </SyncFormField>
        </div>

        {conflictingJobNames.length > 0 ? (
          <Alert severity="error" className="rounded-xl">
            <AlertTitle>目标表已被占用</AlertTitle>
            <AlertDescription className="text-theme-xs">
              任务「{conflictingJobNames.join("、")}」已使用
              <span className="font-mono"> {form.target_table}</span>，请改名或点「重新建议」。
            </AlertDescription>
          </Alert>
        ) : null}

        {form.table.trim() === DIRTY_ORDERS_DEMO_SOURCE_TABLE ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="light" color="warning" size="sm">
              演示源表含脏数据
            </Badge>
            {etlRulesHref ? (
              <Link
                to={etlRulesHref}
                className="text-theme-xs text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
              >
                查看清洗规则
              </Link>
            ) : null}
          </div>
        ) : null}
      </FormSection>

      <FormSection title="同步策略" icon={RefreshCw}>
        <SyncFormField
          label="同步方式"
          hint={
            form.syncMode === "full"
              ? "每次运行清空目标表后重新写入。"
              : "按主键 upsert，首次运行等同全量拉取。"
          }
        >
          <SegmentedChoice
            ariaLabel="同步方式"
            value={form.syncMode}
            options={[
              { value: "full", label: "全量" },
              { value: "incremental", label: "增量" },
            ]}
            onChange={(value) => onChange("syncMode", value)}
          />
        </SyncFormField>

        {form.syncMode === "incremental" ? (
          <div className="grid gap-x-5 gap-y-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-white/[0.02] sm:grid-cols-2">
            <SyncFormField label="主键字段" htmlFor="primary_key">
              <Input
                id="primary_key"
                className={SYNC_CONTROL_CLASS}
                value={form.primaryKey}
                onChange={(e) => onChange("primaryKey", e.target.value)}
                required
              />
            </SyncFormField>
            <SyncFormField label="增量字段" htmlFor="incremental_column">
              <Input
                id="incremental_column"
                className={SYNC_CONTROL_CLASS}
                value={form.incrementalColumn}
                onChange={(e) => onChange("incrementalColumn", e.target.value)}
                required
              />
            </SyncFormField>
          </div>
        ) : null}
      </FormSection>

      <FormSection title="调度" description="留空表示仅手动运行。" icon={Clock3}>
        <SyncFormField
          label="定时 Cron（可选）"
          htmlFor="schedule_cron"
          hint={fieldErrors.schedule_cron ? undefined : "点击下方快捷填入常用表达式。"}
        >
          <Input
            id="schedule_cron"
            className={cn(SYNC_CONTROL_CLASS, "font-mono")}
            value={form.schedule_cron}
            onChange={(e) => onChange("schedule_cron", e.target.value)}
            placeholder="0 2 * * *"
            aria-invalid={Boolean(fieldErrors.schedule_cron)}
            aria-describedby={fieldErrors.schedule_cron ? "schedule_cron-error" : undefined}
          />
        </SyncFormField>
        {fieldErrors.schedule_cron ? (
          <p id="schedule_cron-error" className="text-theme-xs text-error-600 dark:text-error-400">
            {fieldErrors.schedule_cron}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {CRON_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-theme-xs"
                onClick={() => onChange("schedule_cron", preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
          <Label htmlFor="enabled" className="text-theme-sm">
            启用定时调度
          </Label>
          <Switch
            id="enabled"
            checked={form.enabled}
            onCheckedChange={(checked) => onChange("enabled", checked)}
          />
        </div>
      </FormSection>
    </form>
  );
}
