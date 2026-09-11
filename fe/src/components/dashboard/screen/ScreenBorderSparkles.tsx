import { useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ScreenBorderSparkleConfig } from "@/lib/screenBorderSparkle";
import {
  BORDER_FLOW_GLOW_STROKE_PX,
  normalizeScreenBorderSparkle,
  trailLengthToMaskRadiusPx,
} from "@/lib/screenBorderSparkle";
import type { ScreenBorderVariant } from "@/lib/screenVisualStyle";
import { getBorderFlowSegment } from "@/lib/screenBorderFlowPaths";
import { scaleNormalizedFlowPath } from "@/lib/screenBorderFlowPathExtract";
import { ScreenBorderFlowDust } from "./ScreenBorderFlowDust";

type ScreenBorderSparklesProps = {
  sparkles: ScreenBorderSparkleConfig[];
  variant: ScreenBorderVariant;
  className?: string;
  /** 隔离同页多实例的 SVG defs id（如画布 + 配置栏缩略图） */
  instanceScope?: string;
};

type FlowSize = {
  width: number;
  height: number;
};

/** 低于此尺寸不渲染流光，避免 1×1 viewBox + 大半径 mask 撑满整块 */
const MIN_FLOW_PX = 16;

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

function measureFlowSize(el: HTMLElement): FlowSize {
  const rect = el.getBoundingClientRect();
  let width = Math.round(rect.width);
  let height = Math.round(rect.height);

  if (width < MIN_FLOW_PX || height < MIN_FLOW_PX) {
    const parent = el.parentElement;
    if (parent) {
      const parentRect = parent.getBoundingClientRect();
      width = Math.round(parentRect.width);
      height = Math.round(parentRect.height);
    }
  }

  return { width, height };
}

function isFlowSizeReady(size: FlowSize): boolean {
  return size.width >= MIN_FLOW_PX && size.height >= MIN_FLOW_PX;
}

/**
 * 对标 sc-datav Demo1 header：path 与可见描边同坐标，径向渐变光斑 mask + animateMotion 裁切高亮线段。
 * viewBox 与容器像素 1:1，避免 preserveAspectRatio=none 导致流光拉长、运动失真。
 */
function MaskedFlowStroke({
  instanceScope,
  sparkleId,
  path,
  color,
  speed,
  phaseOffset,
  trailLengthPx,
  boundsMinPx,
  viewWidth,
  viewHeight,
}: {
  instanceScope: string;
  sparkleId: string;
  path: string;
  color: string;
  speed: number;
  phaseOffset: number;
  trailLengthPx: number;
  boundsMinPx: number;
  viewWidth: number;
  viewHeight: number;
}) {
  const uid = safeId(sparkleId);
  const scope = safeId(instanceScope);
  const gradId = `border-flow-grad-${scope}-${uid}`;
  const maskId = `border-flow-mask-${scope}-${uid}`;
  const begin = `${-phaseOffset * speed}s`;
  const maskRadius = trailLengthToMaskRadiusPx(trailLengthPx, boundsMinPx);

  return (
    <g>
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          maskContentUnits="userSpaceOnUse"
          x={0}
          y={0}
          width={viewWidth}
          height={viewHeight}
        >
          <rect x={0} y={0} width={viewWidth} height={viewHeight} fill="black" />
          <circle r={maskRadius} cx={0} cy={0} fill={`url(#${gradId})`}>
            <animateMotion
              dur={`${speed}s`}
              repeatCount="indefinite"
              restart="always"
              path={path}
              rotate="auto"
              begin={begin}
              calcMode="linear"
              keyPoints="0;1"
              keyTimes="0;1"
            />
          </circle>
        </mask>
      </defs>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={BORDER_FLOW_GLOW_STROKE_PX}
        vectorEffect="nonScalingStroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        mask={`url(#${maskId})`}
      />
    </g>
  );
}

export function ScreenBorderSparkles({
  sparkles,
  variant,
  className,
  instanceScope,
}: ScreenBorderSparklesProps) {
  const autoScope = useId();
  const scope = safeId(instanceScope ?? autoScope);
  const rootRef = useRef<HTMLDivElement>(null);
  const [flowSize, setFlowSize] = useState<FlowSize>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const update = () => {
      setFlowSize(measureFlowSize(el));
    };

    update();
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      update();
      raf2 = requestAnimationFrame(update);
    });

    const observer = new ResizeObserver(update);
    observer.observe(el);
    const parent = el.parentElement;
    if (parent) observer.observe(parent);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      observer.disconnect();
    };
  }, []);

  if (sparkles.length === 0) return null;

  const { width, height } = flowSize;
  const ready = isFlowSizeReady(flowSize);
  const segment = getBorderFlowSegment(variant, 0);
  const pixelPath = ready ? scaleNormalizedFlowPath(segment.path, width, height) : "";
  const boundsMinPx = Math.min(width, height);

  return (
    <div
      ref={rootRef}
      className={cn("pointer-events-none absolute inset-0", className)}
      data-screen-border-flow
    >
      {pixelPath ? (
        <svg
          className="size-full overflow-visible"
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden
        >
          {sparkles.map((raw, index) => {
            const sparkle = normalizeScreenBorderSparkle(raw);
            const phaseOffset = index / sparkles.length;
            return (
              <g key={sparkle.id}>
                <MaskedFlowStroke
                  instanceScope={scope}
                  sparkleId={sparkle.id}
                  path={pixelPath}
                  color={sparkle.color}
                  speed={sparkle.speed}
                  phaseOffset={phaseOffset}
                  trailLengthPx={sparkle.trailLength}
                  boundsMinPx={boundsMinPx}
                  viewWidth={width}
                  viewHeight={height}
                />
                <ScreenBorderFlowDust
                  pathD={pixelPath}
                  color={sparkle.color}
                  speed={sparkle.speed}
                  phaseOffset={phaseOffset}
                  trailLengthPx={sparkle.trailLength}
                  boundsMinPx={boundsMinPx}
                />
              </g>
            );
          })}
        </svg>
      ) : null}
    </div>
  );
}
