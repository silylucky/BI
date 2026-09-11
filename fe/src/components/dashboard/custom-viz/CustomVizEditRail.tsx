import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { fetchAiVizArtifactMeta } from "@/lib/aiVizArtifacts";
import { queryKeys } from "@/lib/queryKeys";
import type { LayoutWidget, CustomVizWidgetConfig, DashboardStyleConfig } from "../layoutUtils";
import { DatasetPickerPanel } from "../DatasetPickerPanel";
import { FieldBankPlaceholder } from "../DatasetFieldBank";
import { WidgetEditRailLayout } from "../WidgetEditRailLayout";
import { CustomVizEditorColumn } from "./CustomVizEditorColumn";
import type { CustomVizFieldTarget } from "./customVizFieldSlots";
import { sanitizeManifestLabel } from "./customVizManifestLabels";
import { useCustomVizInspectorState } from "./useCustomVizInspectorState";

export type CustomVizEditRailProps = {
  widget: LayoutWidget & { customVizConfig: CustomVizWidgetConfig };
  onChange: (config: CustomVizWidgetConfig) => void;
  onTitleChange?: (title: string) => void;
  onDelete?: () => void;
  onDataRefresh?: () => void;
  dashboardStyle?: DashboardStyleConfig;
  className?: string;
};

export function CustomVizEditRail({
  widget,
  onChange,
  onTitleChange,
  onDelete,
  onDataRefresh,
  dashboardStyle,
  className,
}: CustomVizEditRailProps) {
  const artifactId = widget.customVizConfig.artifactId?.trim();
  const scopeKey = `${widget.id}:${artifactId ?? ""}`;
  const [draftConfig, setDraftConfig] = useState(widget.customVizConfig);

  useEffect(() => {
    setDraftConfig(widget.customVizConfig);
  }, [scopeKey, widget.customVizConfig]);

  const readConfig = useCallback(() => draftConfig, [draftConfig]);
  const emitChange = useCallback(
    (next: CustomVizWidgetConfig) => {
      setDraftConfig(next);
      onChange(next);
    },
    [onChange],
  );

  const [activeFieldTarget, setActiveFieldTarget] = useState<CustomVizFieldTarget>({
    kind: "dimension",
    index: 0,
  });

  const { data: meta } = useQuery({
    queryKey: queryKeys.aiViz.detail(artifactId ?? "none"),
    queryFn: () => fetchAiVizArtifactMeta(artifactId!),
    enabled: Boolean(artifactId),
  });

  const inspector = useCustomVizInspectorState(readConfig, emitChange, meta?.fieldSlots);

  const typeLabel = sanitizeManifestLabel(meta?.manifest.displayName, "自定义组件");
  const leftSubtitle = useMemo(() => {
    return widget.title && widget.title !== typeLabel ? widget.title : undefined;
  }, [typeLabel, widget.title]);

  return (
    <WidgetEditRailLayout
      className={cn("h-full min-h-0", className)}
      leftLabel={typeLabel}
      leftSubtitle={leftSubtitle}
      rightLabel="数据集"
      left={
        <CustomVizEditorColumn
          widgetTitle={widget.title}
          config={draftConfig}
          manifest={meta?.manifest}
          activeFieldTarget={activeFieldTarget}
          onActiveFieldTargetChange={setActiveFieldTarget}
          binding={inspector.binding}
          chartCfg={inspector.chartCfg}
          patchBinding={inspector.patchBinding}
          columns={inspector.columns}
          refreshColumns={inspector.refreshColumns}
          onChange={emitChange}
          onDelete={onDelete}
          onDataRefresh={onDataRefresh}
          onTitleChange={onTitleChange}
          dashboardStyle={dashboardStyle}
          assignField={inspector.assignField}
          fieldAssignError={inspector.fieldAssignError}
          className="min-w-0"
        />
      }
      right={
        artifactId ? (
          <DatasetPickerPanel
            widgetId={widget.id}
            datasetId={inspector.binding.datasetId}
            datasetsLoading={inspector.datasetsLoading}
            datasetsError={inspector.datasetsError}
            datasetsEmpty={inspector.datasetsEmpty}
            datasetItems={inspector.datasetItems}
            columns={inspector.columns}
            columnsLoading={inspector.columnsLoading}
            columnsReady={inspector.columnsReady}
            onDatasetSelect={inspector.handleDatasetSelect}
            datasetBindingError={inspector.datasetBindingError}
            onFieldClick={(field) => inspector.assignField(field, activeFieldTarget)}
            onRefreshFields={inspector.refreshColumns}
          />
        ) : (
          <FieldBankPlaceholder />
        )
      }
    />
  );
}
