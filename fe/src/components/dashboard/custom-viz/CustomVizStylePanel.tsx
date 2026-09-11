import type { DashboardStyleConfig } from "../dashboardStyleConfig";
import type { CustomVizWidgetConfig } from "../layoutUtils";
import {
  CustomVizBackgroundStyleSection,
  CustomVizLabelStyleSection,
  CustomVizPaletteStyleSection,
  CustomVizRemarkStyleSection,
  CustomVizTitleStyleSection,
  CustomVizTooltipStyleSection,
} from "./CustomVizCommonStyleSections";
import { CustomVizStyleForm } from "./CustomVizStyleForm";
import { mergeCustomVizStyleValue, resolveCustomVizStyleSchema } from "./customVizStyleSchema";

type CustomVizStylePanelProps = {
  config: CustomVizWidgetConfig;
  widgetTitle: string;
  dashboardStyle?: DashboardStyleConfig;
  styleSchema?: Record<string, unknown>;
  defaultStyle?: Record<string, unknown>;
  onChange: (next: CustomVizWidgetConfig) => void;
  onTitleChange?: (title: string) => void;
};

const COMMON_SECTIONS = [
  CustomVizBackgroundStyleSection,
  CustomVizPaletteStyleSection,
  CustomVizTitleStyleSection,
  CustomVizRemarkStyleSection,
  CustomVizLabelStyleSection,
  CustomVizTooltipStyleSection,
] as const;

export function CustomVizStylePanel({
  config,
  widgetTitle,
  dashboardStyle,
  styleSchema,
  defaultStyle,
  onChange,
  onTitleChange,
}: CustomVizStylePanelProps) {
  const resolvedStyleSchema = resolveCustomVizStyleSchema(styleSchema, defaultStyle);
  const schemaValue = mergeCustomVizStyleValue(config.style, defaultStyle);
  const sectionProps = { config, widgetTitle, dashboardStyle, onChange, onTitleChange };

  return (
    <div className="flex flex-col gap-0" data-testid="custom-viz-style-panel">
      {COMMON_SECTIONS.map((Section) => (
        <Section key={Section.name} {...sectionProps} />
      ))}
      <CustomVizStyleForm
        styleSchema={resolvedStyleSchema}
        value={schemaValue}
        onChange={(style) => onChange({ ...config, style })}
      />
    </div>
  );
}
