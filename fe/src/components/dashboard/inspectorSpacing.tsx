import { DeAttrField, DeSegmentGroup } from "./dashboardInspectorUi";
import type { SpacingMode } from "./dashboardStyleConfig";

export function SpacingModeToggle({
  label,
  mode,
  onChange,
  compact = true,
}: {
  label: string;
  mode: SpacingMode;
  onChange: (mode: SpacingMode) => void;
  compact?: boolean;
}) {
  return (
    <DeAttrField label={label} compact={compact}>
      <DeSegmentGroup
        value={mode}
        columns={2}
        sizing="fit"
        options={[
          { value: "unified", label: "统一值" },
          { value: "individual", label: "分边" },
        ]}
        onChange={(v) => onChange(v as SpacingMode)}
      />
    </DeAttrField>
  );
}
