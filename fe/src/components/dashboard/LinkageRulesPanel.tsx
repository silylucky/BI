import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { Button } from "@/components/ui/button";
import { SaveFormButton } from "@/components/ui/save-form-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Linkage } from "./dashboardFilterUtils";
import type { LayoutWidget } from "./layoutUtils";
import { InspectorSwitchRow } from "./inspectorCompact";

type LinkageRule = Linkage["linkageRules"][number];

type LinkageRulesPanelProps = {
  dashboardId: string;
  linkage: Linkage | null;
  /** 合并画布筛选器后的有效联动（编辑态优先展示） */
  effectiveLinkage?: Linkage | null;
  widgets: LayoutWidget[];
  /** 草稿模式：规则变更即时回调，不显示单独保存按钮 */
  draftMode?: boolean;
  /** 嵌入仪表板配置手风琴：去掉外层卡片与重复标题 */
  embedded?: boolean;
  onSaved?: (linkage: Linkage) => void;
  onLinkageChange?: (linkage: Linkage) => void;
};

const EMPTY_RULE = {
  sourceFilterId: "",
  targetWidgetIds: [] as string[],
  parameterKey: "",
};

export function LinkageRulesPanel({
  dashboardId,
  linkage,
  effectiveLinkage,
  widgets,
  draftMode = false,
  embedded = false,
  onSaved,
  onLinkageChange,
}: LinkageRulesPanelProps) {
  const [rules, setRules] = useState<LinkageRule[]>([]);
  const [draft, setDraft] = useState(EMPTY_RULE);
  const [refreshMode, setRefreshMode] = useState<Linkage["refreshMode"]>("eager");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedLinkage = effectiveLinkage ?? linkage;
  const filters = resolvedLinkage?.filters ?? [];
  const hasFilters = filters.length > 0;

  useEffect(() => {
    setRules(resolvedLinkage?.linkageRules ?? []);
    setRefreshMode(resolvedLinkage?.refreshMode ?? linkage?.refreshMode ?? "eager");
  }, [resolvedLinkage, linkage]);

  const buildLinkagePayload = (nextRules: LinkageRule[], mode = refreshMode): Linkage => ({
    filters: resolvedLinkage?.filters ?? [],
    linkageRules: nextRules,
    refreshMode: mode,
  });

  const emitLinkage = (nextRules: LinkageRule[], mode?: Linkage["refreshMode"]) => {
    const payload = buildLinkagePayload(nextRules, mode ?? refreshMode);
    onLinkageChange?.(payload);
    return payload;
  };

  const handleRefreshModeChange = (nextMode: Linkage["refreshMode"]) => {
    setRefreshMode(nextMode);
    if (draftMode) emitLinkage(rules, nextMode);
  };

  const chartWidgets = widgets.filter((w) => w.type === "chart");

  const savedLinkageSnapshot = useMemo(
    () =>
      JSON.stringify({
        rules: linkage?.linkageRules ?? [],
        refreshMode: linkage?.refreshMode ?? "eager",
      }),
    [linkage],
  );
  const currentLinkageSnapshot = useMemo(
    () => JSON.stringify({ rules, refreshMode }),
    [rules, refreshMode],
  );
  const isDirty = currentLinkageSnapshot !== savedLinkageSnapshot;

  const handleRulesUpdate = (nextRules: LinkageRule[]) => {
    setRules(nextRules);
    if (draftMode) emitLinkage(nextRules);
  };
  const canAdd =
    draft.sourceFilterId &&
    draft.parameterKey.trim() &&
    draft.targetWidgetIds.length > 0;

  const handleAddRule = () => {
    if (!canAdd) return;
    handleRulesUpdate([
      ...rules,
      {
        sourceFilterId: draft.sourceFilterId,
        targetWidgetIds: [...draft.targetWidgetIds],
        parameterKey: draft.parameterKey.trim(),
      },
    ]);
    setDraft(EMPTY_RULE);
    setError(null);
  };

  const handleRemoveRule = (index: number) => {
    handleRulesUpdate(rules.filter((_, i) => i !== index));
  };

  const toggleTarget = (widgetId: string, checked: boolean) => {
    setDraft((prev) => ({
      ...prev,
      targetWidgetIds: checked
        ? [...prev.targetWidgetIds, widgetId]
        : prev.targetWidgetIds.filter((id) => id !== widgetId),
    }));
  };

  const handleSave = async () => {
    if (!isDirty) return;
    setSaving(true);
    setError(null);
    try {
      const payload = emitLinkage(rules);
      const saved = await apiFetch<Linkage & { affectedWidgetCount?: number }>(
        `/api/v1/dashboards/${dashboardId}/global-filters`,
        { method: "PUT", body: JSON.stringify({ dashboardId, ...payload }) },
      );
      onSaved?.({
        filters: saved.filters ?? payload.filters,
        linkageRules: saved.linkageRules ?? rules,
        refreshMode: saved.refreshMode ?? payload.refreshMode,
      });
      toast.success("联动规则已保存");
    } catch (err) {
      setError(mapApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!hasFilters) {
    return null;
  }

  const panelBody = (
    <>
      {!embedded ? (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">筛选联动</h3>
          {!draftMode ? (
            <SaveFormButton
              type="button"
              variant="primary"
              size="sm"
              isDirty={isDirty}
              saving={saving}
              saveLabel="保存联动"
              onClick={() => void handleSave()}
            />
          ) : null}
        </div>
      ) : null}
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        筛选器值通过 parameterKey 注入目标图表 SQL 的 {`{{key}}`} 占位符。
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="linkage-refresh-mode">筛选刷新</Label>
        <Select
          value={refreshMode}
          onValueChange={(value) => handleRefreshModeChange(value as Linkage["refreshMode"])}
        >
          <SelectTrigger id="linkage-refresh-mode" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="eager">即时刷新</SelectItem>
            <SelectItem value="lazy">手动应用</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          {refreshMode === "lazy"
            ? "预览态修改筛选值后需点击「应用筛选」才会刷新图表。"
            : "预览态修改筛选值后立即刷新关联图表。"}
        </p>
      </div>

      {rules.length > 0 ? (
        <ul className="space-y-2">
          {rules.map((rule, index) => {
            const filterLabel =
              filters.find((f) => f.filterId === rule.sourceFilterId)?.dimensionRef ?? rule.sourceFilterId;
            const targets = rule.targetWidgetIds
              .map((id) => widgets.find((w) => w.id === id)?.title ?? id)
              .join("、");
            return (
              <li
                key={`${rule.sourceFilterId}-${rule.parameterKey}-${index}`}
                className="flex items-start justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 dark:border-gray-800 dark:bg-white/[0.03]"
              >
                <p className="min-w-0 flex-1 text-theme-xs text-gray-700 dark:text-gray-300">
                  <span className="font-medium">{filterLabel}</span>
                  {" → "}
                  <span>{targets || "—"}</span>
                  {" · "}
                  <code className="rounded bg-gray-200/80 px-1 dark:bg-white/10">{rule.parameterKey}</code>
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-7 shrink-0 text-gray-400 hover:text-error-600"
                  aria-label="删除规则"
                  onClick={() => handleRemoveRule(index)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-theme-xs text-gray-400">尚未配置联动规则。</p>
      )}

      <div className="space-y-3 border-t border-gray-100 pt-3 dark:border-gray-800">
        <p className="text-theme-xs font-medium text-gray-600 dark:text-gray-400">添加规则</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="linkage-source-filter">源筛选器</Label>
            <Select
              value={draft.sourceFilterId}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, sourceFilterId: value }))}
            >
              <SelectTrigger id="linkage-source-filter" className="h-9">
                <SelectValue placeholder="选择筛选器" />
              </SelectTrigger>
              <SelectContent>
                {filters.map((f) => (
                  <SelectItem key={f.filterId} value={f.filterId}>
                    {f.dimensionRef}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="linkage-param-key">参数键 parameterKey</Label>
            <Input
              id="linkage-param-key"
              className="h-9"
              placeholder="如 region"
              value={draft.parameterKey}
              onChange={(e) => setDraft((prev) => ({ ...prev, parameterKey: e.target.value }))}
            />
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-theme-xs font-medium text-gray-600 dark:text-gray-400">目标图表</legend>
          <div className="space-y-0">
            {chartWidgets.length > 0 ? (
              chartWidgets.map((w) => (
                <InspectorSwitchRow
                  key={w.id}
                  label={w.title}
                  checked={draft.targetWidgetIds.includes(w.id)}
                  onCheckedChange={(checked) => toggleTarget(w.id, checked)}
                />
              ))
            ) : (
              <p className="text-theme-xs text-gray-400">画布上尚无图表组件。</p>
            )}
          </div>
        </fieldset>
        <Button type="button" variant="outline" size="sm" disabled={!canAdd} onClick={handleAddRule}>
          <Plus className="size-4" aria-hidden />
          添加规则
        </Button>
      </div>

      {error ? <p className="text-theme-xs text-error-600 dark:text-error-400">{error}</p> : null}
    </>
  );

  if (embedded) {
    return <div className="space-y-3">{panelBody}</div>;
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
      {panelBody}
    </div>
  );
}
