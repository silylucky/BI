import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartDeAttrField } from "../chartInspectorDeFields";
import { INSPECTOR_SELECT } from "../inspectorCompact";
import type { ChartLabelStyle } from "@/lib/chartDeStyle";
import { ChartDeLabelContentFields } from "./ChartDeLabelContentFields";

type ChartPieLabelFieldsProps = {
  label: ChartLabelStyle | undefined;
  patchLabel: (patch: Partial<ChartLabelStyle>) => void;
};

/** 饼图标签：内外位置 + 维度/指标/占比（对标 DataEase） */
export function ChartPieLabelFields({ label, patchLabel }: ChartPieLabelFieldsProps) {
  const isOutside = label?.position === "outside";

  return (
    <>
      <ChartDeAttrField label="标签位置">
        <Select
          value={label?.position === "outside" ? "outside" : "inside"}
          onValueChange={(position) =>
            patchLabel({ position: position as "inside" | "outside" })
          }
        >
          <SelectTrigger className={INSPECTOR_SELECT} aria-label="标签位置">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inside">内</SelectItem>
            <SelectItem value="outside">外</SelectItem>
          </SelectContent>
        </Select>
      </ChartDeAttrField>
      <ChartDeLabelContentFields
        label={label}
        patchLabel={patchLabel}
        showAllToggle={isOutside}
        defaultShowDimension={isOutside}
        defaultShowPercent={isOutside}
      />
    </>
  );
}
