import { ChartFieldMultiSlot } from "../ChartFieldMultiSlot";
import { ChartFieldSlot } from "../ChartFieldSlot";
import type { CustomVizDataBinding } from "../layoutUtils";
import {
  customVizFieldTargetsEqual,
  parseCustomVizFieldSlotGroupsForUi,
  type CustomVizFieldTarget,
} from "./customVizFieldSlots";

type CustomVizDataSlotsProps = {
  binding: CustomVizDataBinding;
  fieldSlots?: Record<string, unknown>;
  columnsDisabled?: boolean;
  activeFieldTarget: CustomVizFieldTarget;
  onActiveFieldTargetChange: (target: CustomVizFieldTarget) => void;
  assignField: (fieldName: string, target: CustomVizFieldTarget) => void;
  fieldAssignError?: string | null;
  onPatch: (patch: Partial<CustomVizDataBinding>) => void;
};

function readDimensionFields(binding: CustomVizDataBinding): string[] {
  return (binding.dimensions ?? []).map((d) => d.field?.trim()).filter((f): f is string => Boolean(f));
}

function readMetricFields(binding: CustomVizDataBinding): string[] {
  return (binding.metrics ?? []).map((m) => m.field?.trim()).filter((f): f is string => Boolean(f));
}

function readFieldAt(
  binding: CustomVizDataBinding,
  kind: CustomVizFieldTarget["kind"],
  index: number,
): string | undefined {
  const arr = kind === "dimension" ? binding.dimensions : binding.metrics;
  return arr?.[index]?.field?.trim() || undefined;
}

function metricAggSuffix(fieldName: string): string {
  return /(?:^|_)(amount|amt|count|cnt|qty|quantity|price|total|sum|avg|rate|score|value|values)(?:$|_)/i.test(
    fieldName,
  )
    ? "求和"
    : "计数";
}

export function CustomVizDataSlots({
  binding,
  fieldSlots,
  columnsDisabled = false,
  activeFieldTarget,
  onActiveFieldTargetChange,
  assignField,
  fieldAssignError,
  onPatch,
}: CustomVizDataSlotsProps) {
  const groups = parseCustomVizFieldSlotGroupsForUi(fieldSlots);

  const clearSingleSlot = (target: CustomVizFieldTarget) => {
    if (target.kind === "dimension") {
      const next = [...(binding.dimensions ?? [])];
      if (target.index >= next.length) return;
      next.splice(target.index, 1);
      onPatch({ dimensions: next });
      return;
    }
    const next = [...(binding.metrics ?? [])];
    if (target.index >= next.length) return;
    next.splice(target.index, 1);
    onPatch({ metrics: next });
  };

  return (
    <div className="space-y-3" data-testid="custom-viz-data-slots">
      {fieldAssignError ? (
        <p className="text-theme-xs text-error-600 dark:text-error-400">{fieldAssignError}</p>
      ) : null}
      {groups.map((group) => {
        const targetKind = group.kind;
        const target: CustomVizFieldTarget = { kind: targetKind, index: 0 };

        if (group.uiMode === "multi") {
          const fields =
            targetKind === "dimension" ? readDimensionFields(binding) : readMetricFields(binding);
          return (
            <ChartFieldMultiSlot
              key={group.key}
              label={group.label}
              required={group.required}
              axisId={targetKind === "dimension" ? "xAxis" : "yAxis"}
              fields={fields}
              showAggregation={targetKind === "metric"}
              active={activeFieldTarget.kind === targetKind}
              disabled={columnsDisabled}
              onClick={() =>
                onActiveFieldTargetChange({
                  kind: targetKind,
                  index: fields.length,
                })
              }
              onClearAll={
                fields.length
                  ? () =>
                      onPatch(
                        targetKind === "dimension" ? { dimensions: [] } : { metrics: [] },
                      )
                  : undefined
              }
              onRemoveAt={(index) => {
                const key = targetKind === "dimension" ? "dimensions" : "metrics";
                const next = [...(binding[key] ?? [])];
                next.splice(index, 1);
                onPatch({ [key]: next });
              }}
              onDropField={(field) =>
                assignField(field, { kind: targetKind, index: fields.length })
              }
            />
          );
        }

        const fieldName = readFieldAt(binding, targetKind, 0);
        const aggregationSuffix =
          fieldName && targetKind === "metric" ? metricAggSuffix(fieldName) : undefined;
        return (
          <ChartFieldSlot
            key={group.key}
            label={group.label}
            required={group.required}
            fieldName={fieldName}
            fieldSuffix={aggregationSuffix}
            slotKind={targetKind}
            active={customVizFieldTargetsEqual(activeFieldTarget, { kind: targetKind, index: 0 })}
            disabled={columnsDisabled}
            onClick={() => onActiveFieldTargetChange({ kind: targetKind, index: 0 })}
            onClear={fieldName ? () => clearSingleSlot({ kind: targetKind, index: 0 }) : undefined}
            onDropField={(field) => assignField(field, { kind: targetKind, index: 0 })}
          />
        );
      })}
    </div>
  );
}
