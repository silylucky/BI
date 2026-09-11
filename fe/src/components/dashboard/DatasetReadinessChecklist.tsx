import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = { id: string; label: string; done: boolean };

type DatasetReadinessChecklistProps = {
  dataMode: "dataset" | "sql";
  hasDataSource: boolean;
  hasDataset: boolean;
  hasBoundConfig: boolean;
  hasSyncedConfig: boolean;
  columnsLoaded: boolean;
  className?: string;
};

function StepRow({ label, done }: { label: string; done: boolean }) {
  const Icon = done ? CheckCircle2 : Circle;
  return (
    <li className="flex items-start gap-2 text-theme-xs">
      <Icon
        className={cn(
          "mt-0.5 size-3.5 shrink-0",
          done ? "text-success-500" : "text-gray-400 dark:text-gray-500",
        )}
        aria-hidden
      />
      <span className={done ? "text-gray-600 dark:text-gray-300" : "text-gray-500 dark:text-gray-400"}>
        {label}
      </span>
    </li>
  );
}

export function DatasetReadinessChecklist({
  dataMode,
  hasDataSource,
  hasDataset,
  hasBoundConfig,
  hasSyncedConfig,
  columnsLoaded,
  className,
}: DatasetReadinessChecklistProps) {
  if (dataMode !== "dataset") return null;

  const steps: Step[] = [
    { id: "ds", label: "选择数据源", done: hasDataSource },
    { id: "dataset", label: "选择 Dataset", done: hasDataset },
    { id: "bind", label: "Dataset 已绑定查询配置", done: hasBoundConfig },
    { id: "sync", label: "配置 ID 与数据源已同步", done: hasSyncedConfig },
    { id: "cols", label: "字段预览已加载（可配维度/度量）", done: columnsLoaded },
  ];

  const allDone = steps.every((s) => s.done);
  if (allDone) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-warning-200 bg-warning-50/60 px-3 py-2.5 dark:border-warning-500/30 dark:bg-warning-500/5",
        className,
      )}
    >
      <p className="text-theme-xs font-medium text-warning-700 dark:text-warning-400">
        出图就绪检查
      </p>
      <ul className="mt-2 grid gap-1.5" aria-label="Dataset 就绪步骤">
        {steps.map((step) => (
          <StepRow key={step.id} label={step.label} done={step.done} />
        ))}
      </ul>
    </div>
  );
}

/** 右侧数据集栏内的轻量提示（绑定 Dataset 后展示就绪步骤） */
export function DatasetBindingAlerts({
  dataMode,
  hasDataset,
  hasBoundConfig,
  hasSyncedConfig,
  columnsLoaded,
  className,
}: {
  dataMode: "dataset" | "sql";
  hasDataset: boolean;
  hasBoundConfig: boolean;
  hasSyncedConfig: boolean;
  columnsLoaded: boolean;
  className?: string;
}) {
  return (
    <DatasetReadinessChecklist
      dataMode={dataMode}
      hasDataSource
      hasDataset={hasDataset}
      hasBoundConfig={hasBoundConfig}
      hasSyncedConfig={hasSyncedConfig}
      columnsLoaded={columnsLoaded}
      className={className}
    />
  );
}
