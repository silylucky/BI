import { BarChart3, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  HUB_SEGMENTED_BUTTON_CLASS,
  HUB_SEGMENTED_SHELL_CLASS,
} from "@/components/dashboard/hubFilterUi";
import { cn } from "@/lib/utils";
import type { PresentationMode } from "../standardAnalysisPrefs";

type Props = {
  mode: PresentationMode;
  onChange: (mode: PresentationMode) => void;
  testId?: string;
};

export function StandardAnalysisPresentationToggle({ mode, onChange, testId }: Props) {
  return (
    <div
      className={cn(HUB_SEGMENTED_SHELL_CLASS, "inline-flex gap-0.5 p-0.5")}
      data-testid={testId}
    >
      <Button
        type="button"
        variant={mode === "chart" ? "primary" : "ghost"}
        size="sm"
        className={cn(HUB_SEGMENTED_BUTTON_CLASS, "h-8 gap-1.5 px-3")}
        onClick={() => onChange("chart")}
      >
        <BarChart3 className="size-3.5" aria-hidden />
        图表
      </Button>
      <Button
        type="button"
        variant={mode === "table" ? "primary" : "ghost"}
        size="sm"
        className={cn(HUB_SEGMENTED_BUTTON_CLASS, "h-8 gap-1.5 px-3")}
        onClick={() => onChange("table")}
      >
        <Table2 className="size-3.5" aria-hidden />
        数据表
      </Button>
    </div>
  );
}
