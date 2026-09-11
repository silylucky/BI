import { normalizeScreenShapeStyle, type ScreenShapeStyleConfig } from "@/lib/screenVisualStyle";
import { cn } from "@/lib/utils";

export type ScreenShapeDisplayProps = {
  className?: string;
  styleConfig?: ScreenShapeStyleConfig;
};

function ShapeSvg({
  shape,
  stroke,
  strokeWidth,
  fill,
}: {
  shape: "rect" | "triangle" | "circle";
  stroke: string;
  strokeWidth: number;
  fill: string;
}) {
  if (shape === "rect") {
    return (
      <rect
        x="15"
        y="15"
        width="70"
        height="70"
        rx="2"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }
  if (shape === "triangle") {
    return (
      <polygon
        points="50,12 88,88 12,88"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    );
  }
  return (
    <circle cx="50" cy="50" r="35" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
  );
}

export function ScreenShapeDisplay({ className, styleConfig }: ScreenShapeDisplayProps) {
  const style = normalizeScreenShapeStyle(styleConfig);
  const stroke = style.strokeColor;
  const fill =
    style.fillOpacity > 0
      ? `${stroke}${Math.round(style.fillOpacity * 255).toString(16).padStart(2, "0")}`
      : "transparent";

  return (
    <div
      className={cn("pointer-events-none flex size-full min-h-0 items-center justify-center", className)}
      data-screen-shape
      aria-hidden
    >
      <svg viewBox="0 0 100 100" className="size-[70%]" role="presentation">
        <ShapeSvg
          shape={style.shape}
          stroke={stroke}
          strokeWidth={style.strokeWidth}
          fill={fill}
        />
      </svg>
    </div>
  );
}

export function ScreenShapePreview({
  shape,
  className,
}: {
  shape: "rect" | "triangle" | "circle";
  className?: string;
}) {
  return (
    <div className={cn("relative flex aspect-square w-full items-center justify-center rounded-md bg-[#0a0e14]", className)}>
      <ScreenShapeDisplay
        className="size-10"
        styleConfig={{ shape, strokeColor: "#cbd5e1", strokeWidth: 1.5, fillOpacity: 0 }}
      />
    </div>
  );
}
