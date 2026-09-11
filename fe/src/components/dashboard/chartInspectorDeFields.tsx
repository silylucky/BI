import type { ReactNode } from "react";
import { DeSegmentGroup, type DeSegmentOption } from "./dashboardInspectorUi";
import { INSPECTOR_CTRL, InspectorFieldLabel } from "./inspectorCompact";
import { cn } from "@/lib/utils";

/** chart-edit 窄栏（216px）字段行：对标 DE attr-style 分隔线密度 */
export function ChartDeAttrField({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-b border-gray-100 py-2 last:border-b-0 dark:border-white/[0.06]",
        className,
      )}
    >
      {hint ? (
        <div className="mb-1.5">
          <InspectorFieldLabel label={label} hint={hint} />
        </div>
      ) : (
        <p className="mb-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">{label}</p>
      )}
      {children}
    </div>
  );
}

export function ChartDeSegmentField({
  label,
  value,
  options,
  columns,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<DeSegmentOption & { value: string }>;
  columns?: number;
  onChange: (value: string) => void;
}) {
  return (
    <ChartDeAttrField label={label}>
      <DeSegmentGroup
        value={value}
        options={options}
        columns={columns}
        onChange={(v) => onChange(String(v))}
      />
    </ChartDeAttrField>
  );
}

export const CHART_DE_INPUT = cn(INSPECTOR_CTRL, "w-full bg-white dark:bg-white/[0.03]");
