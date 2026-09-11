import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Database } from "lucide-react";
import { toast } from "sonner";
import { AdminPageShell, AdminPageHeaderIcon } from "@/components/layout/admin-page-shell";
import { ADMIN_PAGE_SURFACE_CLASS } from "@/components/layout/list-page-kit";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UnsavedLeaveDialog } from "@/components/ui/unsaved-leave-dialog";
import { useFormDirtyState } from "@/hooks/use-form-dirty-state";
import { useUnsavedLeaveGuard } from "@/hooks/use-unsaved-leave-guard";
import { ApiRequestError, apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import {
  DISPLAY_GROUP_ORDER,
  groupTypesByDisplayGroup,
  normalizeConnectorTypes,
  type DisplayGroup,
  type RawConnectorTypeItem,
} from "@/lib/connector-taxonomy";
import { queryKeys } from "@/lib/queryKeys";
import { isProtectedDemoDatasource } from "@/lib/demoPackage";
import { isManagedAnalyticsDatasource } from "@/lib/datasourceRoles";
import { cn } from "@/lib/utils";
import { emptyForm, type FormState } from "./components/datasource-form-constants";
import { applyTypePort, DatasourceConnectionForm, DATASOURCE_CONNECTION_FORM_ID } from "./components/DatasourceConnectionForm";
import { DatasourceFormWizard } from "./components/DatasourceFormWizard";
import { DatasourceWizardStepper } from "./components/DatasourceWizardStepper";
import {
  buildFileSourcePayload,
  buildRestApiPayload,
  buildRoapiPayload,
  defaultFileSourceCompanion,
  defaultRestApiCompanion,
  defaultRoapiCompanion,
  sampleRestApiCompanionDefaults,
  sampleRoapiCompanionDefaults,
  validateRestApiBaseUrl,
  type FileSourceCompanionState,
  type RestApiCompanionState,
  type RoapiCompanionState,
} from "./components/datasource-form-types";

type WizardStep = "category" | "type" | "form";
type ConnectorTypeListResponse = { items: RawConnectorTypeItem[] };

const datasourcePageIcon = (
  <AdminPageHeaderIcon>
    <Database className="size-6" aria-hidden />
  </AdminPageHeaderIcon>
);

type DataSourceOut = {
  id: string;
  name: string;
  code: string;
  type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  description?: string | null;
  connectionOptions?: { connectTimeoutSec?: number };
  isDemoPackage?: boolean;
};

function serializeDatasourceDraft({
  mode,
  wizardStep,
  selectedGroup,
  form,
  restApiCompanion,
  roapiCompanion,
  fileCompanion,
}: {
  mode: "create" | "edit";
  wizardStep: WizardStep;
  selectedGroup: DisplayGroup | null;
  form: FormState;
  restApiCompanion: RestApiCompanionState;
  roapiCompanion: RoapiCompanionState;
  fileCompanion: FileSourceCompanionState;
}): string {
  return JSON.stringify({
    mode,
    wizardStep: mode === "create" ? wizardStep : "form",
    selectedGroup: mode === "create" ? selectedGroup : null,
    form: { ...form, password: form.password || "" },
    restApiCompanion,
    roapiCompanion,
    fileCompanion: { ...fileCompanion, fileError: null },
  });
}

export function DatasourceFormPage({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [wizardStep, setWizardStep] = useState<WizardStep>(mode === "create" ? "category" : "form");
  const [selectedGroup, setSelectedGroup] = useState<DisplayGroup | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [restApiCompanion, setRestApiCompanion] = useState(defaultRestApiCompanion);
  const [roapiCompanion, setRoapiCompanion] = useState(defaultRoapiCompanion);
  const [fileCompanion, setFileCompanion] = useState(defaultFileSourceCompanion);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const typesQuery = useQuery({
    queryKey: queryKeys.connectorTypes,
    queryFn: () => apiFetch<ConnectorTypeListResponse>("/api/v1/datasources/types"),
  });

  const connectorTypes = useMemo(
    () => normalizeConnectorTypes(typesQuery.data?.items ?? []),
    [typesQuery.data?.items],
  );

  const groupedTypes = useMemo(
    () => groupTypesByDisplayGroup(connectorTypes),
    [connectorTypes],
  );

  const visibleGroups = useMemo(
    () => DISPLAY_GROUP_ORDER.filter((g) => (groupedTypes.get(g)?.length ?? 0) > 0),
    [groupedTypes],
  );

  const detailQuery = useQuery({
    queryKey: queryKeys.datasources.detail(id ?? ""),
    queryFn: () => apiFetch<DataSourceOut>(`/api/v1/datasources/${id}`),
    enabled: mode === "edit" && Boolean(id),
  });

  const draftSnapshot = useMemo(
    () => ({
      mode,
      wizardStep,
      selectedGroup,
      form,
      restApiCompanion,
      roapiCompanion,
      fileCompanion,
    }),
    [mode, wizardStep, selectedGroup, form, restApiCompanion, roapiCompanion, fileCompanion],
  );

  const { isDirty, isBaselineReady, resetBaseline, markSaved } = useFormDirtyState(
    draftSnapshot,
    serializeDatasourceDraft,
  );

  const hasActionableDraftChanges =
    isDirty && (mode === "edit" || wizardStep === "form");
  const leaveGuardEnabled = isBaselineReady && hasActionableDraftChanges;
  const { leaveDialogOpen, confirmLeave, cancelLeave } = useUnsavedLeaveGuard({
    enabled: leaveGuardEnabled,
  });

  const prevWizardStepRef = useRef<WizardStep>(wizardStep);

  useEffect(() => {
    if (mode === "create") {
      resetBaseline({
        mode,
        wizardStep: "category",
        selectedGroup: null,
        form: emptyForm,
        restApiCompanion: defaultRestApiCompanion(),
        roapiCompanion: defaultRoapiCompanion(),
        fileCompanion: defaultFileSourceCompanion(),
      });
      return;
    }
    if (!detailQuery.data) return;
    const ds = detailQuery.data;
    const nextForm: FormState = {
      name: ds.name,
      code: ds.code,
      type: ds.type,
      host: ds.host,
      port: String(ds.port),
      database: ds.database,
      username: ds.username,
      password: "",
      description: ds.description ?? "",
    };
    let nextRestApi = restApiCompanion;
    let nextRoapi = roapiCompanion;
    let nextFile = fileCompanion;
    if (ds.type === "rest_api") {
      const restAuthMode =
        ds.connectionOptions?.restAuthMode ??
        (ds.username === "none"
          ? "none"
          : ds.username === "oauth2"
            ? "oauth2"
            : ds.username === "bearer"
              ? "bearer"
              : "basic");
      nextRestApi = {
        baseUrl: ds.host,
        authMode: restAuthMode,
        username: restAuthMode === "basic" ? ds.username : "",
        password: "",
        healthPath: ds.database || "/",
        connectTimeoutSec: ds.connectionOptions?.connectTimeoutSec ?? 5,
      };
    } else if (ds.type === "roapi") {
      nextRoapi = {
        baseUrl: ds.host,
        bearerToken: "",
        schemaPath: ds.database || "/api/schema",
        connectTimeoutSec: ds.connectionOptions?.connectTimeoutSec ?? 5,
      };
    } else if (ds.type === "excel" || ds.type === "csv") {
      const isRemote = ds.host.startsWith("http://") || ds.host.startsWith("https://");
      nextFile = {
        mode: isRemote ? "remote" : "local",
        remoteUrl: isRemote ? ds.host : "",
        serverPath: isRemote ? "" : ds.host,
        sheetName: ds.database || "",
        selectedFileName: isRemote ? "" : (ds.host.split("/").pop() ?? ""),
        fileError: null,
      };
    }
    setForm(nextForm);
    setRestApiCompanion(nextRestApi);
    setRoapiCompanion(nextRoapi);
    setFileCompanion(nextFile);
    resetBaseline({
      mode,
      wizardStep: "form",
      selectedGroup: null,
      form: nextForm,
      restApiCompanion: nextRestApi,
      roapiCompanion: nextRoapi,
      fileCompanion: nextFile,
    });
  }, [detailQuery.data, mode, resetBaseline]);

  useEffect(() => {
    if (mode !== "create") {
      prevWizardStepRef.current = wizardStep;
      return;
    }
    if (prevWizardStepRef.current !== "form" && wizardStep === "form") {
      resetBaseline({
        mode,
        wizardStep,
        selectedGroup,
        form,
        restApiCompanion,
        roapiCompanion,
        fileCompanion,
      });
    }
    prevWizardStepRef.current = wizardStep;
  }, [
    mode,
    wizardStep,
    selectedGroup,
    form,
    restApiCompanion,
    roapiCompanion,
    fileCompanion,
    resetBaseline,
  ]);

  useEffect(() => {
    if (errorCode === "DATASOURCE_CODE_CONFLICT" && mode === "create") {
      codeInputRef.current?.focus();
      codeInputRef.current?.select();
    }
  }, [errorCode, mode]);

  const clearError = () => {
    setError(null);
    setErrorCode(null);
  };

  const setField = (key: keyof FormState, value: string) => {
    clearError();
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (): Promise<boolean> => {
    clearError();
    setIsSaving(true);
    try {
      const slice = { name: form.name, code: form.code, type: form.type, description: form.description };
      let payload: Record<string, unknown>;
      if (form.type === "rest_api") {
        const urlError = validateRestApiBaseUrl(restApiCompanion.baseUrl);
        if (urlError) {
          setError(urlError);
          return false;
        }
        payload = buildRestApiPayload(slice, restApiCompanion, mode, form.password);
      } else if (form.type === "roapi") {
        const urlError = validateRestApiBaseUrl(roapiCompanion.baseUrl);
        if (urlError) {
          setError(urlError.replace("Base URL", "RoAPI 地址"));
          return false;
        }
        payload = buildRoapiPayload(slice, roapiCompanion, mode, form.password);
      } else if (form.type === "excel" || form.type === "csv") {
        payload = buildFileSourcePayload(slice, fileCompanion, mode, form.password);
      } else {
        payload = {
          name: form.name,
          type: form.type,
          host: form.host,
          port: Number(form.port),
          database: form.database,
          username: form.username,
          description: form.description || null,
        };
        if (mode === "create") {
          payload.code = form.code;
          payload.password = form.password;
        }
      }

      const saved =
        mode === "create"
          ? await apiFetch<DataSourceOut>("/api/v1/datasources", {
              method: "POST",
              body: JSON.stringify(payload),
            })
          : await apiFetch<DataSourceOut>(`/api/v1/datasources/${id}`, {
              method: "PATCH",
              body: JSON.stringify(form.password ? { ...payload, password: form.password } : payload),
            });

      await queryClient.invalidateQueries({ queryKey: queryKeys.datasources.all });
      if (mode === "create") {
        toast.success("数据源已创建，正在打开详情页，请点击「测试连接」验证");
      } else {
        toast.success("数据源已更新");
      }
      markSaved(draftSnapshot);
      if (mode === "create") {
        navigate(`/admin/datasources/${saved.id}`, {
          replace: true,
          state: { justCreated: true },
        });
      }
      return true;
    } catch (err) {
      if (err instanceof ApiRequestError) setErrorCode(err.code ?? null);
      setError(mapApiError(err));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndLeave = async () => {
    const ok = await handleSave();
    if (ok) confirmLeave();
  };

  const pageDescription = useMemo(() => {
    if (!isBaselineReady) return undefined;
    if (hasActionableDraftChanges) return "有未保存的更改 · 保存后生效";
    if (mode === "create") return "选择连接器类型并填写连接信息以注册新的数据源。";
    return "已保存 · 留空密码表示不修改";
  }, [hasActionableDraftChanges, isBaselineReady, mode]);

  const showHeaderSave = mode === "edit" || (mode === "create" && wizardStep === "form");

  const headerLeadingActions = (
    <Button asChild variant="outline" size="sm">
      <Link to="/admin/datasources">
        <ArrowLeft className="size-4" aria-hidden />
        返回列表
      </Link>
    </Button>
  );

  const headerActions = showHeaderSave ? (
    <Button
      type="submit"
      form={DATASOURCE_CONNECTION_FORM_ID}
      variant="primary"
      size="sm"
      loading={isSaving}
      loadingText="保存中…"
      disabled={isSaving || (mode === "edit" && !isDirty)}
    >
      保存
    </Button>
  ) : null;

  if (mode === "edit" && detailQuery.isLoading) {
    return (
      <AdminPageShell title="编辑数据源" layout="fill" icon={datasourcePageIcon}>
        <Skeleton className="h-full min-h-[480px] w-full rounded-2xl" />
      </AdminPageShell>
    );
  }

  if (
    mode === "edit" &&
    detailQuery.data &&
    (isProtectedDemoDatasource(detailQuery.data) ||
      isManagedAnalyticsDatasource(detailQuery.data))
  ) {
    return <Navigate to={`/admin/datasources/${id}`} replace />;
  }

  const showForm = mode === "edit" || wizardStep === "form";
  const selectedTypeLabel =
    connectorTypes.find((t) => t.type === form.type)?.displayName ?? form.type;

  return (
    <AdminPageShell
      layout="fill"
      title={mode === "create" ? "新建数据源" : "编辑数据源"}
      icon={datasourcePageIcon}
      description={pageDescription}
      leadingActions={headerLeadingActions}
      actions={headerActions}
    >
      {mode === "create" ? (
        <div
          className={cn(
            ADMIN_PAGE_SURFACE_CLASS,
            "flex min-h-0 flex-1 flex-col overflow-hidden",
          )}
        >
          <div className="shrink-0 border-b border-gray-200 px-6 py-5 dark:border-gray-800">
            <DatasourceWizardStepper current={wizardStep} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-6 py-6 lg:px-8 lg:py-8">
            {wizardStep !== "form" ? (
              <DatasourceFormWizard
                wizardStep={wizardStep}
                selectedGroup={selectedGroup}
                visibleGroups={visibleGroups}
                groupedTypes={groupedTypes}
                onSelectGroup={(group) => {
                  setSelectedGroup(group);
                  setWizardStep("type");
                }}
                onBackToCategory={() => setWizardStep("category")}
                onSelectType={(type, port) => {
                  setForm((prev) => ({ ...prev, type, port }));
                  if (type === "rest_api") {
                    setRestApiCompanion(sampleRestApiCompanionDefaults());
                  }
                  if (type === "roapi") {
                    setRoapiCompanion(sampleRoapiCompanionDefaults());
                  }
                  setWizardStep("form");
                }}
              />
            ) : null}

            {showForm ? (
              <DatasourceConnectionForm
                mode={mode}
                form={form}
                selectedTypeLabel={selectedTypeLabel}
                typeItems={connectorTypes}
                error={error}
                errorCode={errorCode}
                isSaving={isSaving}
                advancedOpen={advancedOpen}
                codeInputRef={codeInputRef}
                restApiCompanion={restApiCompanion}
                roapiCompanion={roapiCompanion}
                fileCompanion={fileCompanion}
                embedded
                onChangeType={() => setWizardStep("type")}
                onAdvancedOpenChange={setAdvancedOpen}
                onClearError={clearError}
                onFieldChange={setField}
                onTypeChange={(v) => {
                  clearError();
                  setForm((prev) => ({ ...prev, type: v, port: applyTypePort(v, prev.port) }));
                }}
                onRestApiChange={setRestApiCompanion}
                onRoapiChange={setRoapiCompanion}
                onFileChange={setFileCompanion}
                onSubmit={() => void handleSave()}
                submitDisabled={mode === "edit" && !isDirty}
              />
            ) : null}
          </div>
        </div>
      ) : (
        showForm && (
          <div
            className={cn(
              ADMIN_PAGE_SURFACE_CLASS,
              "flex min-h-0 flex-1 flex-col overflow-hidden",
            )}
          >
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-6 py-6 lg:px-8 lg:py-8">
              <DatasourceConnectionForm
                mode={mode}
                form={form}
                selectedTypeLabel={selectedTypeLabel}
                typeItems={connectorTypes}
                error={error}
                errorCode={errorCode}
                isSaving={isSaving}
                submitDisabled={!isDirty}
                advancedOpen={advancedOpen}
                codeInputRef={codeInputRef}
                restApiCompanion={restApiCompanion}
                roapiCompanion={roapiCompanion}
                fileCompanion={fileCompanion}
                onAdvancedOpenChange={setAdvancedOpen}
                onClearError={clearError}
                onFieldChange={setField}
                onTypeChange={(v) => {
                  clearError();
                  setForm((prev) => ({ ...prev, type: v, port: applyTypePort(v, prev.port) }));
                }}
                onRestApiChange={setRestApiCompanion}
                onRoapiChange={setRoapiCompanion}
                onFileChange={setFileCompanion}
                onSubmit={() => void handleSave()}
              />
            </div>
          </div>
        )
      )}
      <UnsavedLeaveDialog
        open={leaveDialogOpen}
        saving={isSaving}
        entityLabel="数据源"
        onStay={cancelLeave}
        onDiscardLeave={confirmLeave}
        onSaveAndLeave={handleSaveAndLeave}
      />
    </AdminPageShell>
  );
}
