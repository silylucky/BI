import { ChevronLeft, RotateCcw } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { drillBreadcrumbLabels, type ChartDrillFrame } from "@/lib/chartDrill";
import { cn } from "@/lib/utils";

type ChartDrillChromeProps = {
  stack: ChartDrillFrame[];
  onBack: () => void;
  onReset: () => void;
  onNavigate: (depth: number) => void;
  /** 短提示并入面包屑行，避免额外占位 */
  notice?: string | null;
  className?: string;
};

export function ChartDrillChrome({
  stack,
  onBack,
  onReset,
  onNavigate,
  notice,
  className,
}: ChartDrillChromeProps) {
  if (!stack.length) return null;

  const labels = drillBreadcrumbLabels(stack);

  return (
    <div
      className={cn("chart-drill-chrome", className)}
      data-testid="chart-drill-chrome"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="chart-drill-chrome__actions">
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          className="chart-drill-chrome__icon-btn"
          onClick={onBack}
          aria-label="返回上一级"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </IconButton>
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          className="chart-drill-chrome__icon-btn"
          onClick={onReset}
          aria-label="重置钻取"
        >
          <RotateCcw className="size-3.5" aria-hidden />
        </IconButton>
      </div>
      <nav className="chart-drill-chrome__trail" aria-label="钻取路径">
        <button
          type="button"
          className="chart-drill-crumb"
          data-level={0}
          onClick={() => onNavigate(0)}
        >
          全部
        </button>
        {labels.map((label, index) => (
          <span key={`${label}-${index}`} className="chart-drill-chrome__group">
            <span className="chart-drill-chrome__sep" aria-hidden>
              /
            </span>
            <button
              type="button"
              className="chart-drill-crumb"
              data-level={index + 1}
              onClick={() => onNavigate(index + 1)}
            >
              {label}
            </button>
          </span>
        ))}
      </nav>
      {notice ? (
        <p className="chart-drill-chrome__notice" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
