import type { CSSProperties, ReactNode } from "react";
import { buildScreenBorderDeSvg } from "@/lib/screenBorderDeFrames";
import type { ScreenBorderStyleConfig } from "@/lib/screenVisualStyle";
import { normalizeScreenBorderStyle } from "@/lib/screenVisualStyle";
import { cn } from "@/lib/utils";
import type { ScreenBorderVariant } from "@/lib/screenVisualStyle";

type BorderRenderProps = {
  accent: string;
  innerOpacity: number;
  glow?: string;
  className?: string;
  preview?: boolean;
};

function BorderFrame({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn("pointer-events-none relative size-full min-h-0", className)} style={style}>
      {children}
    </div>
  );
}

/** DataEase Board.vue 装饰 SVG，整幅拉伸 + accent 着色 */
function DataEaseScreenBorderSvg({
  variant,
  accent,
  glow,
  className,
  preview,
}: BorderRenderProps & { variant: ScreenBorderVariant }) {
  const svgMarkup = buildScreenBorderDeSvg(variant, accent);

  return (
    <BorderFrame className={className} style={{ boxShadow: glow }}>
      {preview ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background: `radial-gradient(ellipse 80% 55% at 50% 35%, ${accent}16, transparent 70%)`,
          }}
        />
      ) : null}
      <div
        className="absolute inset-0 [&>svg]:block [&>svg]:size-full"
        data-screen-border-de
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
    </BorderFrame>
  );
}

/** 边框缩略图内容区：渐变底 + accent 光晕 + DE 边框 SVG */
export function ScreenBorderThumbContent({
  variant,
  accent,
  innerOpacity,
  className,
}: {
  variant: ScreenBorderVariant;
  accent: string;
  innerOpacity: number;
  className?: string;
}) {
  return (
    <div className={cn("relative size-full min-h-0 overflow-hidden", className)}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(14,22,34,0.96) 0%, rgba(4,7,12,1) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background: `radial-gradient(ellipse 85% 60% at 50% 32%, ${accent}22, transparent 72%)`,
        }}
      />
      {renderScreenBorderVariant(variant, {
        accent,
        innerOpacity,
        className: "p-[10%]",
        preview: true,
      })}
    </div>
  );
}

export function ScreenBorderStyleThumbnail({
  styleConfig,
  className,
}: {
  styleConfig?: ScreenBorderStyleConfig;
  className?: string;
}) {
  const style = normalizeScreenBorderStyle(styleConfig);
  return (
    <ScreenBorderThumbContent
      className={className}
      variant={style.variant}
      accent={style.accentColor}
      innerOpacity={style.innerBorderOpacity}
    />
  );
}

const BORDER_RENDERERS: Record<ScreenBorderVariant, (props: BorderRenderProps) => ReactNode> = {
  "border-1": (props) => <DataEaseScreenBorderSvg variant="border-1" {...props} />,
  "border-2": (props) => <DataEaseScreenBorderSvg variant="border-2" {...props} />,
  "border-3": (props) => <DataEaseScreenBorderSvg variant="border-3" {...props} />,
  "border-4": (props) => <DataEaseScreenBorderSvg variant="border-4" {...props} />,
  "border-5": (props) => <DataEaseScreenBorderSvg variant="border-5" {...props} />,
  "border-6": (props) => <DataEaseScreenBorderSvg variant="border-6" {...props} />,
  "border-7": (props) => <DataEaseScreenBorderSvg variant="border-7" {...props} />,
  "border-8": (props) => <DataEaseScreenBorderSvg variant="border-8" {...props} />,
  "border-9": (props) => <DataEaseScreenBorderSvg variant="border-9" {...props} />,
};

export function renderScreenBorderVariant(
  variant: ScreenBorderVariant,
  props: BorderRenderProps,
): ReactNode {
  return BORDER_RENDERERS[variant]?.(props) ?? BORDER_RENDERERS["border-1"](props);
}

export function ScreenBorderVariantPreview({
  variant,
  className,
  accent = "#22d3ee",
  innerOpacity = 0.38,
}: {
  variant: ScreenBorderVariant;
  className?: string;
  accent?: string;
  innerOpacity?: number;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[4/3] w-full overflow-hidden rounded-md",
        "border border-white/[0.06] bg-[#060a10]",
        className,
      )}
    >
      <ScreenBorderThumbContent variant={variant} accent={accent} innerOpacity={innerOpacity} />
    </div>
  );
}
