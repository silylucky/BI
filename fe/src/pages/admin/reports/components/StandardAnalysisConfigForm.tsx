import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { CalendarClock, ChevronDown, ChevronRight, Database } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SaveFormButton } from "@/components/ui/save-form-button";
import { Input } from "@/components/ui/input";
import { ListPageFooter } from "@/components/layout/list-page-kit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AnalysisPack, SnapshotCronPreset } from "../useStandardAnalysis";
import { standardScheduleHubPath } from "../standardRoutes";
import { SNAPSHOT_LABELS, SNAPSHOT_RETENTION_OPTIONS } from "./standardAnalysisUi";
import { ConfigField, ConfigSection } from "./standardAnalysisConfigUi";
import { ReportMetricDatasetFields } from "./ReportMetricDatasetFields";
import { StandardAnalysisFieldMappingFields } from "./StandardAnalysisFieldMappingFields";
import { StandardAnalysisThemeGrid } from "./StandardAnalysisThemeGrid";
import { StandardSchedulePanel } from "./StandardSchedulePanel";
import { evaluateDraftThemeCapabilities } from "../standardAnalysisValidation";

type Props = {
  draft: AnalysisPack;
  isCreating: boolean;
  editingKey: string | null;
  columnOptions: string[];
  columnKinds?: Record<string, import("@/components/dashboard/datasetFieldClassification").DatasetFieldKind>;
  saving: boolean;
  deleting: boolean;
  isDraftDirty: boolean;
  showSavedHint?: boolean;
  onDismissSavedHint?: () => void;
  onChange: (updater: (current: AnalysisPack) => AnalysisPack) => void;
  onSave: () => Promise<boolean>;
  onDelete: () => void;
};

function CollapsibleDeliverySection({
  packKey,
  children,
}: {
  packKey: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const schedulesHref = standardScheduleHubPath(packKey);

  return (
    <ConfigSection
      inset
      title="定时投递（可选）"
      description="按周期生成 PDF 并通过邮件外发；与「周期快照」不同，快照仅供平台内对比上期。"
    >
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to={schedulesHref}>
              <CalendarClock className="size-4" aria-hidden />
              在调度与投递查看
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-gray-600 dark:text-gray-400"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            {open ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
            {open ? "收起本页配置" : "在本页配置投递"}
          </Button>
        </div>
        {open ? <div className="mt-4 border-t border-gray-100 pt-4 dark:border-white/[0.06]">{children}</div> : null}
      </div>
    </ConfigSection>
  );
}

function BindingStatusBadge({ draft }: { draft: AnalysisPack }) {
  if (draft.datasetId) {
    return (
      <Badge variant="light" color="primary" size="sm" className="gap-1">
        <Database className="size-3" aria-hidden />
        数据集绑定
      </Badge>
    );
  }
  return (
    <Badge variant="light" color="light" size="sm">
      未绑定数据集
    </Badge>
  );
}

export function StandardAnalysisConfigForm({
  draft,
  isCreating,
  editingKey,
  columnOptions,
  columnKinds,
  saving,
  deleting,
  isDraftDirty,
  showSavedHint,
  onDismissSavedHint,
  onChange,
  onSave,
  onDelete,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const handleChange = (updater: (current: AnalysisPack) => AnalysisPack) => {
    onDismissSavedHint?.();
    onChange(updater);
  };

  const themeCapabilities = useMemo(
    () => evaluateDraftThemeCapabilities(draft, columnOptions, columnKinds),
    [draft, columnOptions, columnKinds],
  );

  return (
    <form
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      onSubmit={(event) => {
        event.preventDefault();
        void (async () => {
          const saved = await onSave();
          if (saved) {
            scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
          }
        })();
      }}
    >
      <div className="shrink-0 border-b border-gray-200 bg-gray-50/40 px-5 py-4 dark:border-gray-800 dark:bg-white/[0.02]">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-theme-sm font-semibold text-gray-900 dark:text-white">
                {isCreating ? "新建分析包" : draft.displayName || "未命名分析包"}
              </h2>
              {!isCreating ? <BindingStatusBadge draft={draft} /> : null}
            </div>
            {!isCreating && editingKey ? (
              <p className="mt-1 truncate font-mono text-[11px] text-gray-500 dark:text-gray-400">
                {editingKey}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-gray-50/30 dark:bg-transparent">
        <div className="flex flex-col gap-4 px-4 py-4 md:px-6 md:py-5">
          {showSavedHint && editingKey ? (
            <Alert severity="success" appearance="soft">
              <AlertTitle>分析包已保存</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>需要外发 PDF？可在下方配置定时投递，或前往调度中心统一管理。</span>
                <Button type="button" variant="outline" size="sm" className="shrink-0" asChild>
                  <Link to={standardScheduleHubPath(editingKey)}>
                    <CalendarClock className="size-4" aria-hidden />
                    前往调度与投递
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <ConfigSection title="基本信息" description="工作台与导航中的展示名称；标识保存后不可修改。">
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <ConfigField
                id="packKey"
                label="分析包标识"
                hint={isCreating ? "英文小写与连字符，例如 equipment-overview" : undefined}
              >
                <Input
                  id="packKey"
                  className="h-11 font-mono text-theme-sm"
                  value={draft.packKey}
                  disabled={Boolean(editingKey) && !isCreating}
                  onChange={(event) => handleChange((current) => ({ ...current, packKey: event.target.value }))}
                  placeholder="equipment-overview"
                />
              </ConfigField>
              <ConfigField id="displayName" label="显示名称">
                <Input
                  id="displayName"
                  className="h-11"
                  value={draft.displayName}
                  onChange={(event) => handleChange((current) => ({ ...current, displayName: event.target.value }))}
                  placeholder="设备标准分析"
                />
              </ConfigField>
            </div>
          </ConfigSection>

          <ConfigSection
            title="数据源与字段"
            description="绑定已发布数据集并配置字段映射，供标准分析出数。"
          >
            <ReportMetricDatasetFields
              datasetId={draft.datasetId ?? ""}
              boundConfigId={draft.boundConfigId ?? ""}
              onDatasetIdChange={(datasetId) =>
                handleChange((current) => ({
                  ...current,
                  datasetId,
                  boundConfigId: "",
                  fieldMapping: { status: "", region: "", createdAt: "" },
                }))
              }
              onBoundConfigIdChange={(boundConfigId) =>
                handleChange((current) =>
                  current.boundConfigId === boundConfigId ? current : { ...current, boundConfigId },
                )
              }
              onSuggestedDataSourceId={(dataSourceId) =>
                handleChange((current) =>
                  current.dataSourceId === dataSourceId ? current : { ...current, dataSourceId },
                )
              }
              boundPendingHint="查询绑定已更新，请点击底部「保存」使配置生效。"
              hideBoundPendingHint={showSavedHint}
            />
            <StandardAnalysisFieldMappingFields
              draft={draft}
              columnOptions={columnOptions}
              columnKinds={columnKinds}
              onChange={handleChange}
            />
          </ConfigSection>

          <ConfigSection title="分析主题" description="勾选在「标准分析」消费页展示的主题视图。">
            <StandardAnalysisThemeGrid
              enabledThemes={draft.enabledThemes}
              themeCapabilities={themeCapabilities}
              onToggle={(theme, checked) =>
                handleChange((current) => ({
                  ...current,
                  enabledThemes: checked
                    ? [...current.enabledThemes, theme]
                    : current.enabledThemes.filter((item) => item !== theme),
                }))
              }
            />
          </ConfigSection>

          <ConfigSection
            title="周期快照"
            description="平台按周期保存分析结果供对比上期；不会发送邮件或推送到外部。"
          >
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <ConfigField id="snapshotCronPreset" label="快照周期">
                <Select
                  value={draft.snapshotCronPreset}
                  onValueChange={(value) =>
                    handleChange((current) => ({
                      ...current,
                      snapshotCronPreset: value as SnapshotCronPreset,
                    }))
                  }
                >
                  <SelectTrigger id="snapshotCronPreset" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["daily", "weekly", "monthly"] as const).map((preset) => (
                      <SelectItem key={preset} value={preset}>
                        {SNAPSHOT_LABELS[preset]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ConfigField>
              <ConfigField id="snapshotRetentionPeriods" label="保留期数">
                <Select
                  value={String(draft.snapshotRetentionPeriods ?? 12)}
                  onValueChange={(value) =>
                    handleChange((current) => ({
                      ...current,
                      snapshotRetentionPeriods: Number(value),
                    }))
                  }
                >
                  <SelectTrigger id="snapshotRetentionPeriods" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SNAPSHOT_RETENTION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ConfigField>
            </div>
          </ConfigSection>

          {editingKey && !isCreating ? (
            <CollapsibleDeliverySection packKey={editingKey}>
              <StandardSchedulePanel sourceKey={editingKey} packName={draft.displayName || editingKey} />
            </CollapsibleDeliverySection>
          ) : null}
        </div>
      </div>

      <ListPageFooter>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {showSavedHint ? (
            <p className="text-theme-xs font-medium text-success-600 dark:text-success-400">分析包已保存</p>
          ) : (
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              {isCreating ? "填写完成后保存以创建分析包。" : "修改后点击保存生效。"}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {editingKey && !isCreating ? (
              <Button type="button" variant="destructive" size="sm" disabled={deleting || saving} onClick={onDelete}>
                删除
              </Button>
            ) : null}
            <SaveFormButton
              type="submit"
              size="sm"
              isDirty={isDraftDirty}
              allowSaveWhenClean={isCreating}
              saving={saving}
            />
          </div>
        </div>
      </ListPageFooter>
    </form>
  );
}
