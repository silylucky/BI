import { ChartInspectorSection } from "./inspectorCompact";
import { ChartTableColorFields } from "./chartPaletteLabelTooltipFields";
import { useChartInspector } from "./ChartInspectorContext";
import {
  patchChartDeTableStyle,
  patchChartDeTablePalette,
  readChartDeTableStyle,
  mergeChartTableStyle,
} from "@/lib/chartDeTableStyle";
import { isTableLikeChartType } from "@/lib/chartTableInspector";
import { resolveWidgetEffectiveScheme } from "@/lib/chartSurfaceTheme";
import {
  resolveTableInheritPreviewColors,
  TABLE_PALETTE_INHERIT_LABEL,
} from "@/lib/chartTablePalette";
import { ChartPalettePicker } from "./ChartPalettePicker";
import { ChartDeAttrField } from "./chartInspectorDeFields";

/** 表格配色（S2 / legacy 明细表） */
export function ChartTableColorPanel() {
  const { cfg, onChange, dashboardStyle } = useChartInspector();
  if (!isTableLikeChartType(cfg.chartType)) return null;

  const scheme = resolveWidgetEffectiveScheme(dashboardStyle);
  const rawStyle = readChartDeTableStyle(cfg);
  const tableStyle = mergeChartTableStyle(rawStyle, dashboardStyle?.tableColorStyle, scheme);

  return (
    <ChartInspectorSection title="表格配色" data-testid="table-style-color">
      <ChartDeAttrField label="配色方案" compact>
        <ChartPalettePicker
          showInherit
          inheritLabel={TABLE_PALETTE_INHERIT_LABEL}
          value={rawStyle.tablePaletteId}
          inheritPreviewColors={resolveTableInheritPreviewColors(
            dashboardStyle?.tableColorStyle,
            scheme,
          )}
          onChange={(paletteId) => onChange(patchChartDeTablePalette(cfg, paletteId, scheme))}
        />
      </ChartDeAttrField>
      <ChartTableColorFields
        compact
        wrapSection={false}
        tableStyle={tableStyle}
        onPatch={(patch) => onChange(patchChartDeTableStyle(cfg, patch))}
      />
    </ChartInspectorSection>
  );
}
