import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDown, Database, Settings2 } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConnectorTypeItem } from "@/lib/connector-taxonomy";
import { cn } from "@/lib/utils";
import type { FormState } from "./datasource-form-constants";
import { applyTypePort, DatasourceTypeField, TypeHint } from "./DatasourceTypeField";
import { FileSourceConnectionFields } from "./FileSourceConnectionFields";
import { GenericConnectionFields } from "./GenericConnectionFields";
import { RestApiConnectionFields } from "./RestApiConnectionFields";
import { RoapiConnectionFields } from "./RoapiConnectionFields";
import type { FileSourceCompanionState, RestApiCompanionState, RoapiCompanionState } from "./datasource-form-types";
import { CONNECTION_CONTROL_CLASS, ConnectionFormField } from "./ConnectionFormField";

export const DATASOURCE_CONNECTION_FORM_ID = "datasource-connection-form";

type Props = {
  mode: "create" | "edit";
  form: FormState;
  selectedTypeLabel: string;
  typeItems: ConnectorTypeItem[];
  error: string | null;
  errorCode: string | null;
  isSaving: boolean;
  submitDisabled?: boolean;
  advancedOpen: boolean;
  codeInputRef: RefObject<HTMLInputElement | null>;
  restApiCompanion: RestApiCompanionState;
  roapiCompanion: RoapiCompanionState;
  fileCompanion: FileSourceCompanionState;
  embedded?: boolean;
  formId?: string;
  onChangeType?: () => void;
  onAdvancedOpenChange: (open: boolean) => void;
  onClearError: () => void;
  onFieldChange: (key: keyof FormState, value: string) => void;
  onTypeChange: (type: string) => void;
  onRestApiChange: (next: RestApiCompanionState) => void;
  onRoapiChange: (next: RoapiCompanionState) => void;
  onFileChange: (next: FileSourceCompanionState) => void;
  onSubmit: () => void;
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

function ConnectionFormHeader({
  selectedTypeLabel,
  onChangeType,
}: {
  selectedTypeLabel: string;
  onChangeType?: () => void;
}) {
  return (
    <div className="mx-auto mb-6 w-full max-w-3xl overflow-hidden rounded-2xl border border-brand-200/60 bg-gradient-to-br from-brand-50/70 via-white to-white shadow-theme-xs dark:border-brand-500/20 dark:from-brand-500/10 dark:via-white/[0.02] dark:to-white/[0.02]">
      <div className="h-1 bg-gradient-to-r from-brand-500 to-brand-400" />
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/30">
            <Database className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-theme-base font-semibold tracking-tight text-gray-900 dark:text-white">
              填写连接信息
            </h2>
            <p className="mt-1 text-theme-sm leading-relaxed text-gray-500 dark:text-gray-400">
              注册后可测试连通性并用于查询与仪表板。
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">
          <Badge variant="light" color="primary" size="sm">
            {selectedTypeLabel}
          </Badge>
          {onChangeType ? (
            <Button type="button" variant="outline" size="sm" onClick={onChangeType}>
              更改类型
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DatasourceConnectionForm({
  mode,
  form,
  selectedTypeLabel,
  typeItems,
  error,
  errorCode,
  isSaving,
  submitDisabled = false,
  advancedOpen,
  codeInputRef,
  restApiCompanion,
  roapiCompanion,
  fileCompanion,
  embedded = false,
  formId = DATASOURCE_CONNECTION_FORM_ID,
  onChangeType,
  onAdvancedOpenChange,
  onClearError,
  onFieldChange,
  onTypeChange,
  onRestApiChange,
  onRoapiChange,
  onFileChange,
  onSubmit,
}: Props) {
  const formBody = (
    <form
      id={formId}
      className="mx-auto grid w-full max-w-3xl gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {error ? (
        <Alert severity="error" closable onClose={onClearError} className="rounded-xl">
          <AlertDescription className="text-theme-sm text-error-700 dark:text-error-400">
            {error}
          </AlertDescription>
        </Alert>
      ) : null}

      <FormSection
        title="基本信息"
        description="名称与标识用于在列表、查询与看板绑定中识别此连接。"
        icon={Database}
      >
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          <ConnectionFormField label="名称" htmlFor="name" className="sm:col-span-2">
            <Input
              id="name"
              className={CONNECTION_CONTROL_CLASS}
              value={form.name}
              onChange={(e) => onFieldChange("name", e.target.value)}
              required
              fieldState={errorCode === "DATASOURCE_NAME_CONFLICT" ? "error" : "default"}
              aria-invalid={errorCode === "DATASOURCE_NAME_CONFLICT" || undefined}
            />
          </ConnectionFormField>
          <ConnectionFormField
            label="标识"
            htmlFor="code"
            hint={mode === "edit" ? "创建后不可修改。" : "建议使用小写英文与下划线。"}
          >
            <Input
              ref={codeInputRef}
              id="code"
              className={CONNECTION_CONTROL_CLASS}
              value={form.code}
              onChange={(e) => onFieldChange("code", e.target.value)}
              required
              readOnly={mode === "edit"}
              fieldState={errorCode === "DATASOURCE_CODE_CONFLICT" && mode === "create" ? "error" : "default"}
              aria-invalid={errorCode === "DATASOURCE_CODE_CONFLICT" && mode === "create" ? true : undefined}
            />
          </ConnectionFormField>
          {!embedded ? (
            <DatasourceTypeField
              mode={mode}
              type={form.type}
              selectedTypeLabel={selectedTypeLabel}
              typeItems={typeItems}
              onTypeChange={(v) => onTypeChange(v)}
            />
          ) : null}
        </div>
      </FormSection>

      <FormSection
        title="连接参数"
        description={
          embedded
            ? "保存后可在详情页测试连通性并用于查询。"
            : "主机、库名与凭证；编辑时留空密码表示不修改。"
        }
        icon={Settings2}
      >
        {embedded ? <TypeHint type={form.type} /> : null}

        {form.type === "rest_api" ? (
          <RestApiConnectionFields value={restApiCompanion} onChange={onRestApiChange} />
        ) : form.type === "roapi" ? (
          <RoapiConnectionFields value={roapiCompanion} onChange={onRoapiChange} />
        ) : form.type === "excel" || form.type === "csv" ? (
          <FileSourceConnectionFields sourceType={form.type} value={fileCompanion} onChange={onFileChange} />
        ) : (
          <GenericConnectionFields form={form} mode={mode} onFieldChange={onFieldChange} />
        )}
      </FormSection>

      <Collapsible.Root open={advancedOpen} onOpenChange={onAdvancedOpenChange}>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
          <Collapsible.Trigger
            type="button"
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50/80 dark:hover:bg-white/[0.03]"
          >
            <div>
              <p className="text-theme-sm font-semibold text-gray-900 dark:text-white">高级选项</p>
              <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">可选描述信息，便于团队识别用途。</p>
            </div>
            <ChevronDown
              className={cn("size-4 shrink-0 text-gray-500 transition-transform", advancedOpen && "rotate-180")}
              aria-hidden
            />
          </Collapsible.Trigger>
          <Collapsible.Content className="border-t border-gray-100 px-5 py-5 dark:border-gray-800">
            <ConnectionFormField label="描述" htmlFor="description">
              <Input
                id="description"
                className={CONNECTION_CONTROL_CLASS}
                value={form.description}
                onChange={(e) => onFieldChange("description", e.target.value)}
                placeholder="例如：生产环境订单库只读账号"
              />
            </ConnectionFormField>
          </Collapsible.Content>
        </div>
      </Collapsible.Root>
    </form>
  );

  if (embedded) {
    return (
      <div className="w-full">
        <ConnectionFormHeader selectedTypeLabel={selectedTypeLabel} onChangeType={onChangeType} />
        {formBody}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mx-auto mb-6 flex w-full max-w-3xl items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/40 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">当前连接器类型</p>
        <Badge variant="light" color="primary" size="sm">
          {selectedTypeLabel}
        </Badge>
      </div>
      {formBody}
    </div>
  );
}

export { applyTypePort };
