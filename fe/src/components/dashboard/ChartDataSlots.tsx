import { isChartFieldDropDisabled } from "@/lib/chartFieldDrag";
import { ChartFieldMultiSlot } from "./ChartFieldMultiSlot";
import { ChartFieldSlot } from "./ChartFieldSlot";
import { chartDataSlotBlueprint } from "./chartFieldSlots";
import { useChartInspector } from "./chartInspectorContext";
import { classifyDatasetField } from "./datasetFieldClassification";
import { isSameSlotTarget, type SlotTarget } from "./chartInspectorTypes";
import { MapChartFieldHintBanner } from "./MapChartFieldHint";
import { mapChartFieldHint } from "@/lib/mapChartDataHint";
import { isGeoMapChartType } from "@/lib/chartViewConfig";
import {
  axisFieldList,
  clearAxis,
  clearAxisField,
  fieldAtSlot,
  removeAxisFieldAt,
} from "@/lib/resolveChartEncoding";

function slotKindForUi(kind: "dimension" | "metric" | "both"): "dimension" | "metric" {
  return kind === "metric" ? "metric" : "dimension";
}

export function ChartDataSlots({ hideMapHint = false }: { hideMapHint?: boolean }) {
  const {
    cfg,
    onChange,
    columns,
    columnsLoading,
    columnsReady,
    activeSlot,
    setActiveSlot,
    assignField,
    fieldAssignError,
    clearFieldAssignError,
  } = useChartInspector();

  const columnsDisabled = isChartFieldDropDisabled(columnsLoading, columns);
  const slots = chartDataSlotBlueprint(cfg.chartType);
  const mapHint = isGeoMapChartType(cfg.chartType) ? mapChartFieldHint(columns) : null;

  const clearSlot = (target: SlotTarget) => {
    clearFieldAssignError();
    onChange(clearAxisField(cfg, target));
  };

  return (
    <div className="space-y-3" data-testid={`chart-data-slots-${cfg.chartType}`}>
      {fieldAssignError ? (
        <p className="rounded-md border border-error-200 bg-error-50 px-2 py-1.5 text-[10px] leading-snug text-error-700 dark:border-error-200/30 dark:bg-error-500/10 dark:text-error-400">
          {fieldAssignError}
        </p>
      ) : null}
      {mapHint && !hideMapHint ? <MapChartFieldHintBanner hint={mapHint} /> : null}
      {columnsReady && columnsLoading ? (
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">正在加载字段…</p>
      ) : null}
      {slots.map((slot) => {
        const target: SlotTarget = { axisId: slot.axisId, index: slot.index };

        if (slot.uiMode === "multi") {
          const fields = axisFieldList(cfg, slot.axisId);
          return (
            <ChartFieldMultiSlot
              key={`${slot.axisId}-multi`}
              label={slot.label}
              required={slot.required !== false}
              axisId={slot.axisId}
              fields={fields}
              showAggregation={slot.showAggregation}
              active={activeSlot?.axisId === slot.axisId}
              disabled={columnsDisabled}
              onClick={() => {
                clearFieldAssignError();
                setActiveSlot(target);
              }}
              onClearAll={
                fields.length
                  ? () => onChange(clearAxis(cfg, slot.axisId))
                  : undefined
              }
              onRemoveAt={(index) => onChange(removeAxisFieldAt(cfg, slot.axisId, index))}
              onDropField={(field) => assignField(field, target)}
            />
          );
        }

        const rawField = fieldAtSlot(cfg, target);
        const aggregationSuffix =
          rawField && slot.showAggregation
            ? classifyDatasetField(rawField) === "metric"
              ? "求和"
              : "计数"
            : undefined;
        return (
          <ChartFieldSlot
            key={`${slot.axisId}-${slot.index}-${slot.label}`}
            label={slot.label}
            required={slot.required !== false}
            optional={slot.required === false}
            fieldName={rawField}
            fieldSuffix={aggregationSuffix}
            slotKind={slotKindForUi(slot.kind)}
            active={isSameSlotTarget(activeSlot, target)}
            disabled={columnsDisabled}
            onClick={() => {
              clearFieldAssignError();
              setActiveSlot(target);
            }}
            onClear={rawField ? () => clearSlot(target) : undefined}
            onDropField={(field) => assignField(field, target)}
          />
        );
      })}
    </div>
  );
}
