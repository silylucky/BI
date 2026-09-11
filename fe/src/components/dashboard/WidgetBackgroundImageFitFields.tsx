import { DeAttrField, DeSegmentGroup } from "./dashboardInspectorUi";
import type { WidgetStyleConfig } from "./dashboardStyleConfig";
import {
  WIDGET_BACKGROUND_IMAGE_FIT_OPTIONS,
  inferDefaultBackgroundImageFitForUrl,
  normalizeBackgroundImageFitForUi,
  type WidgetBackgroundImageFit,
} from "@/lib/widgetBackgroundImageFit";

type WidgetBackgroundImageFitFieldsProps = {
  value: WidgetStyleConfig;
  onChange: (patch: Partial<WidgetStyleConfig>) => void;
};

export function WidgetBackgroundImageFitFields({
  value,
  onChange,
}: WidgetBackgroundImageFitFieldsProps) {
  if (!value?.backgroundImage?.trim()) return null;

  const fitDefaults = inferDefaultBackgroundImageFitForUrl(value.backgroundImage ?? "");
  const fit = value.backgroundImageFit ?? fitDefaults?.backgroundImageFit ?? "stretch";
  const uiFit = normalizeBackgroundImageFitForUi(fit);

  return (
    <div data-testid="widget-background-image-fit-fields">
      <DeAttrField label="适应方式" compact className="border-b-0 py-0">
        <DeSegmentGroup
          value={uiFit}
          options={WIDGET_BACKGROUND_IMAGE_FIT_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
          columns={3}
          sizing="fit"
          onChange={(next) =>
            onChange({
              backgroundImageFit: next as WidgetBackgroundImageFit,
            })
          }
        />
      </DeAttrField>
    </div>
  );
}
