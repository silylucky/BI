import type { ShapePresentationLayers } from "@/lib/chartDeStyle";
import { shouldUseWidgetBackgroundImageLayer } from "@/lib/widgetDecorBackground";
import { WidgetDecorBackgroundLayer } from "./WidgetDecorBackgroundLayer";

type LayerStackProps = {
  layers: ShapePresentationLayers;
  prefix: string;
};

export function WidgetShellBackgroundLayers({ layers, prefix }: LayerStackProps) {
  return layers.backgroundLayers.map((layer, index) => {
    if (!layer) return null;
    if (shouldUseWidgetBackgroundImageLayer(layer)) {
      return (
        <WidgetDecorBackgroundLayer
          key={`${prefix}-bg-${index}`}
          layer={layer}
          testId={`${prefix}-bg-${index}`}
        />
      );
    }
    return (
      <div
        key={`${prefix}-bg-${index}`}
        data-testid={`${prefix}-bg-${index}`}
        className="pointer-events-none absolute inset-0 z-0"
        style={layer}
        aria-hidden
      />
    );
  });
}

export function WidgetShellFrameLayers({
  layers,
  prefix,
  zClassName = "z-[2]",
}: LayerStackProps & { zClassName?: string }) {
  return layers.frameLayers.map((layer, index) =>
    layer ? (
      <div
        key={`${prefix}-frame-${index}`}
        className={`pointer-events-none absolute inset-0 ${zClassName}`}
        style={layer}
        aria-hidden
        data-testid={`${prefix}-frame-${index}`}
      />
    ) : null,
  );
}
