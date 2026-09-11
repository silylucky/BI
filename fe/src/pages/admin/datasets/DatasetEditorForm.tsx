import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ComputedFieldsEditor } from "./ComputedFieldsEditor";
import { DatasetTransformRulesPanel } from "./components/DatasetTransformRulesPanel";
import { DatasetTablePicker } from "./DatasetTablePicker";
import type { DatasetComputedField, DatasetEditorValues, DatasetOrigin } from "./types";

export const DATASET_EDITOR_FORM_ID = "dataset-editor-form";

function activeComputedFields(fields: DatasetComputedField[]): DatasetComputedField[] {
  return fields.filter((field) => field.name.trim() || field.expression.trim());
}

export function datasetSubmitBlockers(values: DatasetEditorValues): string[] {
  const blockers: string[] = [];
  if (!values.datasetId.trim()) blockers.push("填写 Dataset ID");
  if (!values.displayName.trim()) blockers.push("填写显示名");
  if (!values.tables[0]?.name?.trim()) blockers.push("在 Schema 树中选择数据表");
  const incomplete = activeComputedFields(values.computedFields).filter(
    (field) => !field.name.trim() || !field.expression.trim(),
  );
  if (incomplete.length > 0) blockers.push("补全计算字段的名称与表达式，或删除空行");
  return blockers;
}

export function canSubmitDataset(values: DatasetEditorValues): boolean {
  return datasetSubmitBlockers(values).length === 0;
}

function DatasetFormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-3", className)}>
      <div>
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function DatasetEditorForm({
  mode,
  values,
  onChange,
  onSubmit,
  tablePickerPrefill,
  origin = "manual",
  transformRulesPrefill,
  isDemoPackage = false,
}: {
  mode: "create" | "edit";
  values: DatasetEditorValues;
  onChange: Dispatch<SetStateAction<DatasetEditorValues>>;
  onSubmit: () => void;
  tablePickerPrefill?: {
    preferredDataSourceId?: string;
    prefillTable?: string;
    savedDataSourceId?: string;
    onDataSourceIdChange?: (dataSourceId: string) => void;
    boundConfigId?: string | null;
    syncJobId?: string | null;
    onRefreshBinding?: () => void;
    onTableChange?: () => void;
  };
  origin?: DatasetOrigin;
  transformRulesPrefill?: {
    datasetId: string;
    columnNames: string[];
    columnsLoading: boolean;
    hasDataSource: boolean;
    disabledReason?: string | null;
  };
  isDemoPackage?: boolean;
}) {
  const patch = useCallback(
    (update: SetStateAction<DatasetEditorValues>) => onChange(update),
    [onChange],
  );
  const tableTabLabel = "数据表";
  const computedTabLabel = `计算字段${values.computedFields.length > 0 ? ` (${values.computedFields.length})` : ""}`;
  const showTransformTab = mode === "edit" && Boolean(transformRulesPrefill);

  return (
    <Card className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <CardHeader className="shrink-0 border-b border-gray-100 pb-4 dark:border-gray-800">
        {mode === "create" ? (
          <>
            <CardTitle>Dataset 配置</CardTitle>
            <CardDescription>
              从数据源选择物理表、管理出图字段并定义计算字段，供报表与仪表板复用。
            </CardDescription>
          </>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid min-w-0 flex-1 gap-1.5 sm:max-w-md">
              <Label htmlFor="edit-name" className="text-theme-xs text-gray-600 dark:text-gray-400">
                显示名
              </Label>
              <Input
                id="edit-name"
                value={values.displayName}
                disabled={isDemoPackage}
                onChange={(e) => patch((current) => ({ ...current, displayName: e.target.value }))}
                className="h-11"
              />
            </div>
            <Badge variant="light" color="light" size="sm" className="mb-0.5 font-mono">
              {values.datasetId}
            </Badge>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <form
          id={DATASET_EDITOR_FORM_ID}
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          {mode === "create" ? (
            <div className="shrink-0 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
              <DatasetFormSection
                title="基本信息"
                description="Dataset 在列表与绑定配置中的展示标识。"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="ds-id">Dataset ID</Label>
                    <Input
                      id="ds-id"
                      value={values.datasetId}
                      onChange={(e) => patch((current) => ({ ...current, datasetId: e.target.value }))}
                      placeholder="ds-orders"
                      className="h-11 font-mono"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ds-name">显示名</Label>
                    <Input
                      id="ds-name"
                      value={values.displayName}
                      onChange={(e) => patch((current) => ({ ...current, displayName: e.target.value }))}
                      placeholder="订单分析集"
                      className="h-11"
                    />
                  </div>
                </div>
              </DatasetFormSection>
            </div>
          ) : null}

          <Tabs defaultValue="tables" className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-gray-100 px-6 py-3 dark:border-gray-800">
              <TabsList variant="enclosed" size="sm" className="w-fit">
                <TabsTrigger value="tables">{tableTabLabel}</TabsTrigger>
                <TabsTrigger value="computed">{computedTabLabel}</TabsTrigger>
                {showTransformTab ? (
                  <TabsTrigger value="transform-rules">查询清洗</TabsTrigger>
                ) : null}
              </TabsList>
            </div>

            <TabsContent
              value="tables"
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-4 data-[state=inactive]:hidden"
            >
              <DatasetTablePicker
                tables={values.tables}
                onChange={(tables) => patch((current) => ({ ...current, tables }))}
                preferredDataSourceId={tablePickerPrefill?.preferredDataSourceId}
                prefillTable={tablePickerPrefill?.prefillTable}
                savedDataSourceId={tablePickerPrefill?.savedDataSourceId}
                onDataSourceIdChange={tablePickerPrefill?.onDataSourceIdChange}
                origin={origin}
                bindDraft={values.bindDraft}
                onBindDraftChange={(bindDraft) => patch((current) => ({ ...current, bindDraft }))}
                boundConfigId={tablePickerPrefill?.boundConfigId}
                syncJobId={tablePickerPrefill?.syncJobId}
                onRefreshBinding={tablePickerPrefill?.onRefreshBinding}
                onTableChange={tablePickerPrefill?.onTableChange}
                isDemoPackage={isDemoPackage}
              />
            </TabsContent>

            <TabsContent
              value="computed"
              className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 py-4 data-[state=inactive]:hidden"
            >
              <DatasetFormSection
                title="计算字段"
                description="基于物理列编写表达式，供图表与查询服务引用。"
              >
                <ComputedFieldsEditor
                  fields={values.computedFields}
                  onChange={(computedFields) => patch((current) => ({ ...current, computedFields }))}
                  disabled={isDemoPackage}
                />
              </DatasetFormSection>
            </TabsContent>

            {showTransformTab && transformRulesPrefill ? (
              <TabsContent
                value="transform-rules"
                className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
              >
                <DatasetTransformRulesPanel
                  datasetId={transformRulesPrefill.datasetId}
                  columnNames={transformRulesPrefill.columnNames}
                  columnsLoading={transformRulesPrefill.columnsLoading}
                  hasDataSource={transformRulesPrefill.hasDataSource}
                  disabledReason={transformRulesPrefill.disabledReason}
                />
              </TabsContent>
            ) : null}
          </Tabs>
        </form>
      </CardContent>
    </Card>
  );
}
