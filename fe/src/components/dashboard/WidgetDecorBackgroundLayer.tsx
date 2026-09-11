import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import {
  decorImageUsesAxisFit,
  resolveDecorFlexLayout,
  resolveWidgetBackgroundImageLayerPresentation,
  resolveDecorImagePresentation,
} from "@/lib/widgetDecorBackground";

type WidgetShellLayerProps = {
  layer: CSSProperties;
  className?: string;
  testId?: string;
};

/** 顶栏/无边框装饰：限制在组件框内，按适应方式缩放 */
export function WidgetDecorBackgroundLayer({
  layer,
  className,
  testId,
}: WidgetShellLayerProps) {
  const resolved = resolveWidgetBackgroundImageLayerPresentation(layer);
  if (!resolved) return null;

  const imageStyle = resolveDecorImagePresentation(
    resolved.fit,
    resolved.position,
  );
  const flexLayout = resolveDecorFlexLayout(resolved.position);
  const axisFit = decorImageUsesAxisFit(resolved.fit);

  return (
    <div
      data-testid={testId}
      className={cn(
        "pointer-events-none absolute inset-0 z-0 flex overflow-hidden",
        className,
      )}
      style={{ ...flexLayout, borderRadius: resolved.borderRadius }}
      aria-hidden
    >
      <img
        src={resolved.displayUrl}
        alt=""
        draggable={false}
        className={cn(
          "block select-none",
          axisFit ? "max-h-full max-w-full shrink-0" : "h-full w-full min-h-0 min-w-0",
        )}
        style={{
          ...imageStyle,
          opacity: resolved.opacity,
        }}
      />
    </div>
  );
}
