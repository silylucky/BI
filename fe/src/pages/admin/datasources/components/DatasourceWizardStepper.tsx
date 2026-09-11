import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type DatasourceWizardStep = "category" | "type" | "form";

const STEPS: { id: DatasourceWizardStep; label: string }[] = [
  { id: "category", label: "选择大类" },
  { id: "type", label: "选择连接器" },
  { id: "form", label: "连接配置" },
];

type DatasourceWizardStepperProps = {
  current: DatasourceWizardStep;
};

export function DatasourceWizardStepper({ current }: DatasourceWizardStepperProps) {
  const currentIndex = STEPS.findIndex((step) => step.id === current);

  return (
    <ol className="flex flex-wrap items-center gap-3 sm:gap-4" aria-label="新建数据源步骤">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step.id} className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-theme-xs font-semibold",
                  done && "bg-brand-500 text-white",
                  active && "bg-brand-500 text-white ring-4 ring-brand-500/15",
                  !done && !active && "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
                )}
                aria-hidden
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-theme-sm",
                  active ? "font-semibold text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 ? (
              <span className="hidden h-px w-8 bg-gray-200 sm:block dark:bg-gray-800" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
