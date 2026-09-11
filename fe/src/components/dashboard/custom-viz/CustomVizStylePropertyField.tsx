import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TEXT_COLOR_RECOMMENDED } from "@/components/dashboard/dashboardStyleConfig";
import { ChartDeAttrField, CHART_DE_INPUT } from "../chartInspectorDeFields";
import { ChartDeSliderField } from "../deAttrSlider";
import { INSPECTOR_SELECT_TRIGGER, InspectorInlineColorRow, InspectorSwitchRow } from "../inspectorCompact";
import type { StyleProperty } from "./customVizStyleSchema";
import {
  resolveCustomVizStyleEnumLabel,
  resolveCustomVizStylePropertyLabel,
} from "./customVizManifestLabels";

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

type CustomVizStylePropertyFieldProps = {
  propKey: string;
  prop: StyleProperty;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
};

export function CustomVizStylePropertyField({
  propKey,
  prop,
  value,
  onChange,
}: CustomVizStylePropertyFieldProps) {
  const label = resolveCustomVizStylePropertyLabel(propKey, prop.title);
  const current = value[propKey];
  const hint = prop.description?.trim();

  if (prop.type === "boolean") {
    return (
      <InspectorSwitchRow
        label={label}
        hint={hint}
        checked={readBoolean(current, false)}
        onCheckedChange={(checked) => onChange({ ...value, [propKey]: checked })}
      />
    );
  }

  if (prop.format === "color" || (prop.type === "string" && prop.format === "color")) {
    const color = typeof current === "string" && current ? current : "#2563eb";
    return (
      <InspectorInlineColorRow
        label={label}
        hint={hint}
        value={color}
        swatches={TEXT_COLOR_RECOMMENDED}
        allowClear={false}
        fallbackValue="#2563eb"
        onChange={(next) => onChange({ ...value, [propKey]: next ?? "#2563eb" })}
      />
    );
  }

  if (Array.isArray(prop.enum) && prop.enum.length > 0) {
    const selected = typeof current === "string" ? current : prop.enum[0];
    return (
      <ChartDeAttrField label={label} hint={hint}>
        <Select
          value={selected}
          onValueChange={(next) => onChange({ ...value, [propKey]: next })}
        >
          <SelectTrigger className={INSPECTOR_SELECT_TRIGGER} aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {prop.enum.map((option, index) => (
              <SelectItem key={option} value={option}>
                {resolveCustomVizStyleEnumLabel(option, prop.enumNames, index, propKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ChartDeAttrField>
    );
  }

  if (prop.type === "number") {
    const isOpacity = prop.format === "opacity";
    const min = typeof prop.minimum === "number" ? prop.minimum : isOpacity ? 0 : 0;
    const max = typeof prop.maximum === "number" ? prop.maximum : isOpacity ? 100 : 100;
    const step = typeof prop.step === "number" ? prop.step : isOpacity ? 1 : 1;
    const fallback = readNumber(current, min);
    return (
      <ChartDeSliderField
        label={label}
        hint={hint}
        value={readNumber(current, fallback)}
        fallback={fallback}
        min={min}
        max={max}
        step={step}
        unit={isOpacity ? "%" : undefined}
        layout="stacked"
        onChange={(next) => onChange({ ...value, [propKey]: next })}
      />
    );
  }

  return (
    <ChartDeAttrField label={label} hint={hint}>
      <Input
        className={CHART_DE_INPUT}
        value={current != null ? String(current) : ""}
        onChange={(e) => onChange({ ...value, [propKey]: e.target.value })}
      />
    </ChartDeAttrField>
  );
}
