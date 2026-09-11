import { Columns3, Plus, Sparkles, Wand2 } from "lucide-react";
import {
  ListPageBatchActions,
} from "@/components/layout/list-batch-delete";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListGhostEmptyState } from "@/components/ui/panel-empty-state";
import { cn } from "@/lib/utils";
import { EtlRuleCard, type EtlRule } from "./EtlRuleCard";

type EtlRulesEditorProps = {
  rules: EtlRule[];
  columnNames: string[];
  columnsLoading: boolean;
  columnsReady: boolean;
  hasDataSource: boolean;
  fieldErrors: boolean;
  isDirty: boolean;
  saving: boolean;
  batchMode: boolean;
  selectedCount: number;
  showDemoTemplate: boolean;
  demoSourceTable: string;
  /** sync=同步写库前；dataset-query=外部源 Dataset 查询时 */
  variant?: "sync" | "dataset-query";
  onToggleBatchMode: () => void;
  onClearSelection: () => void;
  onRemoveSelected: () => void;
  onAddRule: () => void;
  onAutoAlign: () => void;
  onApplyDemoTemplate: () => void;
  onSave: () => void;
  onRemoveRule: (index: number) => void;
  onTypeChange: (index: number, type: string) => void;
  onFieldChange: (index: number, key: string, value: string) => void;
  isSelected: (index: number) => boolean;
  onToggleSelect: (index: number) => void;
};

export function EtlRulesEditor({
  rules,
  columnNames,
  columnsLoading,
  columnsReady,
  hasDataSource,
  fieldErrors,
  isDirty,
  saving,
  batchMode,
  selectedCount,
  showDemoTemplate,
  demoSourceTable,
  variant = "sync",
  onToggleBatchMode,
  onClearSelection,
  onRemoveSelected,
  onAddRule,
  onAutoAlign,
  onApplyDemoTemplate,
  onSave,
  onRemoveRule,
  onTypeChange,
  onFieldChange,
  isSelected,
  onToggleSelect,
}: EtlRulesEditorProps) {
  const columnHint = columnsLoading
    ? "正在加载列…"
    : columnsReady
      ? `已识别 ${columnNames.length} 列`
      : hasDataSource
        ? "未能读取源表列"
        : "未绑定源连接";

  const isDatasetQuery = variant === "dataset-query";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-5 py-5 lg:px-8 lg:py-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
          <Alert severity="info" appearance="subtle" className="rounded-xl">
            <AlertTitle className="text-theme-sm">
              {isDatasetQuery ? "查询时自动清洗，无需逐条手配" : "同步时自动清洗，无需逐条手配"}
            </AlertTitle>
            <AlertDescription className="text-theme-xs leading-relaxed">
              {isDatasetQuery ? (
                <>
                  外部源 Dataset 在每次查询出数后会自动去空格、推断数值、过滤 deleted。
                  本页规则用于<strong className="font-medium text-gray-700 dark:text-gray-300">覆盖或补充</strong>
                  默认行为；保存后在图表绑定该 Dataset 时生效。
                </>
              ) : (
                <>
                  类似 Pandas 整列处理：运行同步时会自动去空格、推断数值、过滤 deleted、填充备注空值。
                  本页规则用于<strong className="font-medium text-gray-700 dark:text-gray-300">覆盖或补充</strong>
                  默认行为；打开页面时会自动扫描全部列并保存。
                </>
              )}
            </AlertDescription>
          </Alert>

          <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="light"
                  color="primary"
                  size="sm"
                  startIcon={<Sparkles className="size-3.5" aria-hidden />}
                >
                  {rules.length} 条规则
                </Badge>
                <Badge
                  variant="light"
                  color="light"
                  size="sm"
                  startIcon={<Columns3 className="size-3.5" aria-hidden />}
                >
                  {columnHint}
                </Badge>
                {isDirty ? (
                  <Badge variant="light" color="warning" size="sm">
                    未保存
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!hasDataSource || columnsLoading}
                  onClick={onAutoAlign}
                >
                  <Wand2 className="size-4" aria-hidden />
                  一键对齐全部列
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onAddRule}>
                  <Plus className="size-4" aria-hidden />
                  添加规则
                </Button>
              </div>
            </div>
          </div>

          {showDemoTemplate ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3 dark:border-brand-500/30 dark:bg-brand-500/10">
              <p className="text-theme-xs text-gray-600 dark:text-gray-300">
                演示源表 <span className="font-mono text-gray-800 dark:text-gray-200">{demoSourceTable}</span>
                ：可快速应用 amount→float 与 status 过滤模板。
              </p>
              <Button type="button" variant="outline" size="sm" onClick={onApplyDemoTemplate}>
                应用演示模板
              </Button>
            </div>
          ) : null}

          <ListPageBatchActions
            batchMode={batchMode}
            onToggleBatchMode={onToggleBatchMode}
            selectedCount={selectedCount}
            entityLabel="条规则"
            onClear={onClearSelection}
            onDelete={onRemoveSelected}
          />

          {rules.length === 0 ? (
            <ListGhostEmptyState
              icon={<Wand2 className="size-6 text-brand-500" aria-hidden />}
              title="暂无额外规则"
              description={
                isDatasetQuery
                  ? "查询时会自动执行默认清洗。若需显式记录重命名/类型转换，可点「一键对齐全部列」或手动添加。"
                  : "同步运行时会自动执行默认清洗。若需显式记录重命名/类型转换，可点「一键对齐全部列」或手动添加。"
              }
              density="compact"
              action={
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!hasDataSource || columnsLoading}
                  onClick={onAutoAlign}
                >
                  <Wand2 className="size-4" aria-hidden />
                  一键对齐全部列
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {rules.map((rule, index) => (
                <EtlRuleCard
                  key={index}
                  rule={rule}
                  index={index}
                  batchMode={batchMode}
                  selected={isSelected(index)}
                  columnNames={columnNames}
                  fieldErrors={fieldErrors}
                  onToggleSelect={() => onToggleSelect(index)}
                  onRemove={() => onRemoveRule(index)}
                  onTypeChange={(type) => onTypeChange(index, type)}
                  onFieldChange={(key, value) => onFieldChange(index, key, value)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <footer
        className={cn(
          "shrink-0 border-t border-gray-200 bg-gray-50/80 px-5 py-4 dark:border-gray-800 dark:bg-white/[0.02]",
          "lg:px-8",
        )}
      >
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3">
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {isDirty
              ? isDatasetQuery
                ? "有未保存的更改，保存后 Dataset 查询才会使用新规则。"
                : "有未保存的更改，保存后同步任务才会使用新规则。"
              : "规则已同步到当前编辑状态。"}
          </p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={saving}
            disabled={!isDirty}
            onClick={onSave}
          >
            保存规则
          </Button>
        </div>
      </footer>
    </div>
  );
}
