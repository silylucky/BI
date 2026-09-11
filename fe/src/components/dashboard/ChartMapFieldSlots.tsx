import { CircleHelp } from "lucide-react";
import { ChartFieldSlot } from "./ChartFieldSlot";
import { useChartInspector } from "./chartInspectorContext";
import { isChartFieldDropDisabled } from "@/lib/chartFieldDrag";
import { isSameSlotTarget, type SlotTarget } from "./chartInspectorTypes";
import { clearAxisField, fieldAtSlot } from "@/lib/resolveChartEncoding";

const MAP_DRILL_SLOT_INDEXES = [0, 1] as const;
const MAP_DRILL_SLOT_LABELS: Record<(typeof MAP_DRILL_SLOT_INDEXES)[number], string> = {
  0: "钻取 / 市级",
  1: "钻取 / 区县",
};

function drillTarget(index: number): SlotTarget {
  return { axisId: "drill", index };
}

/** 对标 DE：钻取区可叠放市、区县字段（VitalSpan 省→市→县扩展） */
function ChartMapDrillSlots({ columnsDisabled }: { columnsDisabled: boolean }) {
  const {
    cfg,
    onChange,
    activeSlot,
    setActiveSlot,
    assignField,
    clearFieldAssignError,
  } = useChartInspector();

  const filled = MAP_DRILL_SLOT_INDEXES.filter((i) =>
    Boolean(fieldAtSlot(cfg, drillTarget(i))),
  );
  const nextEmpty = MAP_DRILL_SLOT_INDEXES.find((i) => !fieldAtSlot(cfg, drillTarget(i)));
  const visibleIndexes = [...filled, ...(nextEmpty !== undefined ? [nextEmpty] : [])];

  const hintIcon = (
    <CircleHelp
      className="size-3 text-gray-400 dark:text-gray-500"
      aria-label="预览态双击地图下钻；依次拖入市级、区县字段"
    />
  );

  return (
    <div className="space-y-1">
      <span className="inline-flex items-center gap-1 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
        钻取 / 维度
        {hintIcon}
      </span>
      <div className="space-y-1.5">
        {visibleIndexes.map((index) => {
          const target = drillTarget(index);
          const rawField = fieldAtSlot(cfg, target);
          return (
            <ChartFieldSlot
              key={`drill-${index}`}
              label={MAP_DRILL_SLOT_LABELS[index]}
              hideLabel
              optional
              fieldName={rawField}
              slotKind="dimension"
              active={
                isSameSlotTarget(activeSlot, target) ||
                Boolean(activeSlot?.axisId === "drill" && rawField)
              }
              disabled={columnsDisabled}
              onClick={() => {
                clearFieldAssignError();
                setActiveSlot(target);
              }}
              onClear={rawField ? () => onChange(clearAxisField(cfg, target)) : undefined}
              onDropField={(field) => assignField(field, target)}
            />
          );
        })}
      </div>
    </div>
  );
}

/** 对标 DataEase 地图数据槽位：地区/维度 → 数据/指标 → 钻取/维度 */
export function ChartMapFieldSlots() {
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

  const renderSlot = (
    target: SlotTarget,
    label: string,
    opts: { required?: boolean; showAggregation?: boolean },
  ) => {
    const rawField = fieldAtSlot(cfg, target);
    return (
      <ChartFieldSlot
        key={`${target.axisId}-${target.index}`}
        label={label}
        required={opts.required}
        fieldName={rawField}
        fieldSuffix={rawField && opts.showAggregation ? "求和" : undefined}
        slotKind={target.axisId === "yAxis" ? "metric" : "dimension"}
        active={isSameSlotTarget(activeSlot, target)}
        disabled={columnsDisabled}
        onClick={() => {
          clearFieldAssignError();
          setActiveSlot(target);
        }}
        onClear={rawField ? () => onChange(clearAxisField(cfg, target)) : undefined}
        onDropField={(field) => assignField(field, target)}
      />
    );
  };

  return (
    <div className="space-y-3">
      {fieldAssignError ? (
        <p className="rounded-md border border-error-200 bg-error-50 px-2 py-1.5 text-[10px] leading-snug text-error-700 dark:border-error-200/30 dark:bg-error-500/10 dark:text-error-400">
          {fieldAssignError}
        </p>
      ) : null}
      {columnsReady && columnsLoading ? (
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">正在加载字段…</p>
      ) : null}
      {renderSlot({ axisId: "xAxis", index: 0 }, "地区 / 维度", { required: true })}
      {renderSlot({ axisId: "yAxis", index: 0 }, "数据 / 指标", {
        required: true,
        showAggregation: true,
      })}
      <ChartMapDrillSlots columnsDisabled={columnsDisabled} />
    </div>
  );
}
