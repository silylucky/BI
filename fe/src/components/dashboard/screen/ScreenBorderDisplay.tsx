import type { ScreenBorderStyleConfig } from "@/lib/screenVisualStyle";
import { normalizeScreenBorderStyle } from "@/lib/screenVisualStyle";
import { cn } from "@/lib/utils";
import { renderScreenBorderVariant, ScreenBorderStyleThumbnail } from "./screenBorderVariants";
import { ScreenBorderSparkles } from "./ScreenBorderSparkles";

export type ScreenBorderDisplayProps = {
  className?: string;
  styleConfig?: ScreenBorderStyleConfig;
  /** 配置栏缩略图等场景关闭流光，避免与画布实例 SVG id 冲突 */
  showSparkle?: boolean;
};

export { ScreenBorderStyleThumbnail };

/** 对标 DataEase 素材边框 + screen-panel 角标发光 */
export function ScreenBorderDisplay({
  className,
  styleConfig,
  showSparkle = true,
}: ScreenBorderDisplayProps) {
  const style = normalizeScreenBorderStyle(styleConfig);
  const accent = style.accentColor;
  const glow = style.glowEnabled
    ? `0 0 18px ${accent}22, 0 0 4px ${accent}14, inset 0 1px 0 rgba(255,255,255,0.06)`
    : undefined;

  return (
    <div
      className={cn("pointer-events-none relative size-full min-h-0", className)}
      data-screen-border
      aria-hidden
    >
      {renderScreenBorderVariant(style.variant, {
        accent,
        innerOpacity: style.innerBorderOpacity,
        glow,
      })}
      {showSparkle && style.sparkle.enabled ? (
        <ScreenBorderSparkles
          sparkles={style.sparkle.sparkles}
          variant={style.variant}
        />
      ) : null}
    </div>
  );
}
