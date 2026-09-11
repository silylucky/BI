import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HUB_SEGMENTED_BUTTON_CLASS,
  HUB_SEGMENTED_SHELL_CLASS,
} from "@/components/dashboard/hubFilterUi";
import { cn } from "@/lib/utils";
import type { CompareLayout } from "../standardAnalysisComparePrefs";
import {
  COMPARE_AUTO_BASELINE,
  COMPARE_LIVE_VALUE,
  snapshotsForTheme,
} from "../standardAnalysisComparePrefs";
import type { AnalysisTheme, SnapshotRecord } from "../useStandardAnalysis";

type Props = {
  layout: CompareLayout;
  onLayoutChange: (layout: CompareLayout) => void;
  activeTheme: AnalysisTheme;
  livePeriodKey: string;
  snapshots?: SnapshotRecord[];
  currentPeriodValue: string;
  baselinePeriodValue: string;
  matrixPeriodKeys: string[];
  onCurrentPeriodChange: (value: string) => void;
  onBaselinePeriodChange: (value: string) => void;
  onMatrixPeriodKeysChange: (keys: string[]) => void;
};

export function StandardAnalysisCompareControls({
  layout,
  onLayoutChange,
  activeTheme,
  livePeriodKey,
  snapshots,
  currentPeriodValue,
  baselinePeriodValue,
  matrixPeriodKeys,
  onCurrentPeriodChange,
  onBaselinePeriodChange,
  onMatrixPeriodKeysChange,
}: Props) {
  const themeSnapshots = snapshotsForTheme(snapshots, activeTheme);
  const snapshotKeys = themeSnapshots.map((item) => item.periodKey);

  const toggleMatrixKey = (periodKey: string, checked: boolean) => {
    const next = checked
      ? [...matrixPeriodKeys, periodKey]
      : matrixPeriodKeys.filter((key) => key !== periodKey);
    onMatrixPeriodKeysChange([...new Set(next)]);
  };

  return (
    <div className="space-y-3 border-b border-gray-200 px-5 py-3 dark:border-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={cn(HUB_SEGMENTED_SHELL_CLASS, "inline-flex gap-0.5 p-0.5")}>
          <Button
            type="button"
            variant={layout === "pair" ? "primary" : "ghost"}
            size="sm"
            className={cn(HUB_SEGMENTED_BUTTON_CLASS, "h-8 px-3")}
            onClick={() => onLayoutChange("pair")}
          >
            两期对比
          </Button>
          <Button
            type="button"
            variant={layout === "matrix" ? "primary" : "ghost"}
            size="sm"
            className={cn(HUB_SEGMENTED_BUTTON_CLASS, "h-8 px-3")}
            onClick={() => onLayoutChange("matrix")}
          >
            多期并排
          </Button>
        </div>
        {layout === "pair" ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Label className="shrink-0 text-theme-xs text-gray-500 dark:text-gray-400">本期</Label>
              <Select value={currentPeriodValue} onValueChange={onCurrentPeriodChange}>
                <SelectTrigger className="h-8 w-[11rem] text-theme-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={COMPARE_LIVE_VALUE}>实时查询（{livePeriodKey}）</SelectItem>
                  {snapshotKeys.map((key) => (
                    <SelectItem key={key} value={key}>
                      快照 {key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="shrink-0 text-theme-xs text-gray-500 dark:text-gray-400">对比期</Label>
              <Select value={baselinePeriodValue} onValueChange={onBaselinePeriodChange}>
                <SelectTrigger className="h-8 w-[11rem] text-theme-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={COMPARE_AUTO_BASELINE}>自动（上一周期）</SelectItem>
                  {snapshotKeys.map((key) => (
                    <SelectItem key={key} value={key}>
                      快照 {key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
      </div>

      {layout === "matrix" ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Label className="w-full text-theme-xs text-gray-500 dark:text-gray-400">
            选择要并排展示的周期（至少 2 个；含实时查询）
          </Label>
          <label className="flex items-center gap-2 text-theme-xs text-gray-700 dark:text-gray-300">
            <Checkbox
              checked={matrixPeriodKeys.includes(livePeriodKey)}
              onCheckedChange={(checked) => toggleMatrixKey(livePeriodKey, checked === true)}
            />
            实时查询（{livePeriodKey}）
          </label>
          {themeSnapshots.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-2 text-theme-xs text-gray-700 dark:text-gray-300"
            >
              <Checkbox
                checked={matrixPeriodKeys.includes(item.periodKey)}
                onCheckedChange={(checked) => toggleMatrixKey(item.periodKey, checked === true)}
              />
              快照 {item.periodKey}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
