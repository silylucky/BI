import type { DeAxisId } from "@/lib/chartDeAxis";

/** Inspector 槽位目标：DE 命名轴 + 轴内索引 */
export type SlotTarget = {
  axisId: DeAxisId;
  index: number;
};

export function isSameSlotTarget(a: SlotTarget | null, b: SlotTarget): boolean {
  return a?.axisId === b.axisId && a?.index === b.index;
}

/** 笛卡尔类图表常用槽位 */
export const SLOT_X_AXIS: SlotTarget = { axisId: "xAxis", index: 0 };
export const SLOT_Y_AXIS: SlotTarget = { axisId: "yAxis", index: 0 };
