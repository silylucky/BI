import { ChartInspectorSection } from "../inspectorCompact";
import { CustomVizStylePropertyField } from "./CustomVizStylePropertyField";
import {
  groupCustomVizStyleProperties,
  readStyleSchemaProperties,
} from "./customVizStyleSchema";

type CustomVizStyleFormProps = {
  styleSchema?: Record<string, unknown>;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
};

export function CustomVizStyleForm({ styleSchema, value, onChange }: CustomVizStyleFormProps) {
  const properties = readStyleSchemaProperties(styleSchema);
  const sections = groupCustomVizStyleProperties(styleSchema);

  if (Object.keys(properties).length === 0) {
    return (
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        该组件未声明可编辑样式（manifest.styleSchema）。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0" data-testid="custom-viz-style-form">
      {sections.map((section) => (
        <ChartInspectorSection key={section.title} title={section.title} defaultOpen>
          <div className="flex flex-col">
            {section.propertyKeys.map((key) => {
              const prop = properties[key];
              if (!prop) return null;
              return (
                <CustomVizStylePropertyField
                  key={key}
                  propKey={key}
                  prop={prop}
                  value={value}
                  onChange={onChange}
                />
              );
            })}
          </div>
        </ChartInspectorSection>
      ))}
    </div>
  );
}
