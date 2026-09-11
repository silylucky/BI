import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SvgProps = { className?: string };

const fillHi = "fill-current";
const fillMid = "fill-current opacity-70";
const fillLo = "fill-current opacity-45";
const fillDim = "fill-current opacity-25";
const strokeHi = "stroke-current fill-none stroke-[2.5]";
const strokeMid = "stroke-current fill-none stroke-[2] opacity-70";
const strokeDim = "stroke-current fill-none stroke-[1.5] opacity-30";

export function PreviewSvg({ className, children }: SvgProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-full text-brand-500", className)} aria-hidden>
      {children}
    </svg>
  );
}

export function PreviewGauge({ className }: SvgProps) {
  return (
    <PreviewSvg className={className}>
      <path d="M8 34a16 16 0 0 1 32 0" className={cn(strokeDim, "stroke-[3]")} />
      <path d="M8 34a16 16 0 0 1 24-18" className={cn(strokeHi, "stroke-[3]")} />
      <line x1="24" y1="34" x2="31" y2="17" className={strokeHi} />
      <circle cx="24" cy="34" r="2.5" className={fillHi} />
    </PreviewSvg>
  );
}

export function PreviewLiquid({ className }: SvgProps) {
  return (
    <PreviewSvg className={className}>
      <circle cx="24" cy="24" r="15" className={cn(strokeDim, "stroke-[2]")} />
      <path d="M10 28c3-4 6-4 9 0s6 4 9 0 6-4 9 0v8H10z" className={fillHi} />
    </PreviewSvg>
  );
}

export function PreviewKpi({ className }: SvgProps) {
  return (
    <PreviewSvg className={className}>
      <text x="24" y="22" textAnchor="middle" className="fill-current text-[14px] font-bold">
        123
      </text>
      <rect x="12" y="28" width="24" height="4" rx="1" className={fillHi} />
    </PreviewSvg>
  );
}

export function PreviewTableGrid({ className, variant = "info" }: SvgProps & { variant?: "info" | "normal" | "pivot" | "heatmap" }) {
  if (variant === "normal") {
    return (
      <PreviewSvg className={className}>
        <rect x="10" y="12" width="8" height="26" rx="1" className={fillHi} />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x="20" y={12 + i * 7} width="18" height="5" rx="0.5" className={i === 0 ? fillMid : fillDim} />
        ))}
      </PreviewSvg>
    );
  }
  if (variant === "pivot") {
    return (
      <PreviewSvg className={className}>
        <rect x="10" y="12" width="28" height="28" rx="1" className={cn(strokeDim, "stroke-[1.5]")} />
        <path d="M10 12 38 38" className={cn(strokeHi, "stroke-[2]")} />
        <rect x="12" y="14" width="10" height="4" className={fillMid} />
        <rect x="24" y="14" width="12" height="4" className={fillLo} />
      </PreviewSvg>
    );
  }
  if (variant === "heatmap") {
    return (
      <PreviewSvg className={className}>
        {[0, 1, 2, 3].map((r) =>
          [0, 1, 2, 3].map((c) => (
            <rect
              key={`${r}-${c}`}
              x={11 + c * 7}
              y={11 + r * 7}
              width="6"
              height="6"
              rx="0.5"
              className={[fillLo, fillMid, fillHi, fillMid][(r + c) % 4]}
            />
          )),
        )}
      </PreviewSvg>
    );
  }
  return (
    <PreviewSvg className={className}>
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}-${c}`} x={11 + c * 9} y={11 + r * 9} width="7" height="7" rx="0.5" className={fillDim} />
        )),
      )}
    </PreviewSvg>
  );
}

export function PreviewLineTrend({ className, area = false, stacked = false }: SvgProps & { area?: boolean; stacked?: boolean }) {
  const d1 = "M8 32 L16 24 L24 28 L32 16 L40 20";
  const d2 = "M8 36 L16 30 L24 32 L32 24 L40 26 L40 36 L8 36 Z";
  return (
    <PreviewSvg className={className}>
      {area ? <path d={`${d1} L40 36 L8 36 Z`} className={fillLo} /> : null}
      {stacked ? <path d={d2} className={fillMid} /> : null}
      <path d={d1} className={cn(strokeHi, "stroke-linecap-round stroke-linejoin-round")} />
    </PreviewSvg>
  );
}

export function PreviewBars({
  className,
  horizontal = false,
  stacked = false,
  grouped = false,
  percent = false,
  range = false,
  bidirectional = false,
  progress = false,
  waterfall = false,
  stock = false,
  bullet = false,
}: SvgProps & {
  horizontal?: boolean;
  stacked?: boolean;
  grouped?: boolean;
  percent?: boolean;
  range?: boolean;
  bidirectional?: boolean;
  progress?: boolean;
  waterfall?: boolean;
  stock?: boolean;
  bullet?: boolean;
}) {
  if (progress) {
    return (
      <PreviewSvg className={className}>
        <rect x="10" y="20" width="28" height="8" rx="4" className={fillDim} />
        <rect x="10" y="20" width="18" height="8" rx="4" className={fillHi} />
      </PreviewSvg>
    );
  }
  if (stock) {
    return (
      <PreviewSvg className={className}>
        <line x1="24" y1="10" x2="24" y2="38" className={strokeMid} />
        <rect x="20" y="14" width="8" height="8" className={fillLo} />
        <rect x="20" y="22" width="8" height="12" className={fillHi} />
      </PreviewSvg>
    );
  }
  if (bullet) {
    return (
      <PreviewSvg className={className}>
        <rect x="10" y="22" width="28" height="4" rx="1" className={fillDim} />
        <rect x="10" y="21" width="16" height="6" rx="1" className={fillHi} />
        <line x1="28" y1="18" x2="28" y2="30" className={strokeMid} />
      </PreviewSvg>
    );
  }
  if (waterfall) {
    return (
      <PreviewSvg className={className}>
        <rect x="10" y="24" width="6" height="12" className={fillMid} />
        <rect x="18" y="18" width="6" height="8" className={fillHi} />
        <rect x="26" y="14" width="6" height="12" className={fillLo} />
        <rect x="34" y="20" width="6" height="16" className={fillMid} />
      </PreviewSvg>
    );
  }
  if (bidirectional) {
    return (
      <PreviewSvg className={className}>
        <rect x="10" y="16" width="12" height="5" className={fillMid} />
        <rect x="26" y="16" width="12" height="5" className={fillHi} />
        <rect x="14" y="27" width="10" height="5" className={fillLo} />
        <rect x="26" y="27" width="10" height="5" className={fillMid} />
      </PreviewSvg>
    );
  }
  if (range) {
    return (
      <PreviewSvg className={className}>
        <line x1="12" y1="24" x2="36" y2="24" className={cn(strokeMid, "stroke-[3]")} />
        <rect x="18" y="20" width="12" height="8" rx="1" className={fillHi} />
      </PreviewSvg>
    );
  }
  if (horizontal) {
    return (
      <PreviewSvg className={className}>
        {[0, 1, 2].map((i) => (
          <rect key={i} x={10} y={12 + i * 10} width={[22, 28, 16][i]} height="6" rx="1" className={[fillMid, fillHi, fillLo][i]} />
        ))}
      </PreviewSvg>
    );
  }
  if (grouped) {
    return (
      <PreviewSvg className={className}>
        {[0, 1, 2].map((g) => (
          <g key={g}>
            <rect x={12 + g * 11} y={36 - [14, 22, 18][g]!} width="3" height={[14, 22, 18][g]!} className={fillHi} />
            <rect x={16 + g * 11} y={36 - [10, 16, 12][g]!} width="3" height={[10, 16, 12][g]!} className={fillMid} />
          </g>
        ))}
      </PreviewSvg>
    );
  }
  if (percent || stacked) {
    return (
      <PreviewSvg className={className}>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x={12 + i * 10} y="14" width="6" height="10" className={fillLo} />
            <rect x={12 + i * 10} y="24" width="6" height="12" className={fillMid} />
            {!percent ? <rect x={12 + i * 10} y="36" width="6" height="2" className={fillHi} /> : null}
          </g>
        ))}
      </PreviewSvg>
    );
  }
  return (
    <PreviewSvg className={className}>
      <rect x="12" y="22" width="6" height="14" rx="1" className={fillLo} />
      <rect x="21" y="14" width="6" height="22" rx="1" className={fillHi} />
      <rect x="30" y="26" width="6" height="10" rx="1" className={fillMid} />
    </PreviewSvg>
  );
}

export function PreviewPie({ className, donut = false, rose = false }: SvgProps & { donut?: boolean; rose?: boolean }) {
  if (rose) {
    return (
      <PreviewSvg className={className}>
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={`M24 24 L${24 + Math.cos((i * 72 - 90) * Math.PI / 180) * 16} ${24 + Math.sin((i * 72 - 90) * Math.PI / 180) * 16} A16 16 0 0 1 ${24 + Math.cos(((i + 1) * 72 - 90) * Math.PI / 180) * 16} ${24 + Math.sin(((i + 1) * 72 - 90) * Math.PI / 180) * 16} Z`}
            className={[fillHi, fillMid, fillLo, fillMid, fillLo][i]}
          />
        ))}
        {donut ? <circle cx="24" cy="24" r="6" className="fill-gray-100 dark:fill-[#1a2231]" /> : null}
      </PreviewSvg>
    );
  }
  return (
    <PreviewSvg className={className}>
      <path d="M24 8a16 16 0 0 1 14 24L24 24Z" className={fillHi} />
      <path d="M38 32a16 16 0 0 1-28 0L24 24Z" className={fillMid} />
      <path d="M10 32a16 16 0 0 1 14-24L24 24Z" className={fillLo} />
      {donut ? <circle cx="24" cy="24" r="6" className="fill-gray-100 dark:fill-[#1a2231]" /> : null}
    </PreviewSvg>
  );
}

export function PreviewRadar({ className }: SvgProps) {
  return (
    <PreviewSvg className={className}>
      <polygon points="24,10 36,18 32,34 16,34 12,18" className={cn(strokeDim, "stroke-[1.5]")} />
      <polygon points="24,16 30,20 28,30 20,30 18,20" className={fillLo} />
      <polygon points="24,14 32,20 28,32 16,32 14,20" className={cn(strokeHi, "stroke-[2]")} />
    </PreviewSvg>
  );
}

export function PreviewTreemap({ className }: SvgProps) {
  return (
    <PreviewSvg className={className}>
      <rect x="10" y="12" width="16" height="24" className={fillHi} />
      <rect x="28" y="12" width="10" height="12" className={fillMid} />
      <rect x="28" y="26" width="10" height="10" className={fillLo} />
    </PreviewSvg>
  );
}

export function PreviewWordCloud({ className }: SvgProps) {
  return (
    <PreviewSvg className={className}>
      <text x="14" y="20" className="fill-current text-[10px] font-bold">A</text>
      <text x="26" y="18" className="fill-current text-[8px] opacity-70">词</text>
      <text x="18" y="32" className="fill-current text-[9px] opacity-50">云</text>
      <text x="30" y="34" className="fill-current text-[11px] font-semibold">BI</text>
    </PreviewSvg>
  );
}

export function PreviewMap({ className }: SvgProps) {
  return (
    <PreviewSvg className={className}>
      <path d="M14 18l6-4 8 3 10-2v18l-10 4-8-5-6 3V18z" className={fillLo} />
      <path d="M20 14v8M28 17v6" className={cn(strokeMid, "stroke-[1.5]")} />
    </PreviewSvg>
  );
}

/** 3D 地图：挤出块 + 透视底图 */
export function PreviewMap3d({ className }: SvgProps) {
  return (
    <PreviewSvg className={className}>
      <path d="M12 30l12-6 12 6-12 6z" className={fillLo} />
      <path d="M18 22v8l6 3V25l-6-3z" className={fillMid} />
      <path d="M24 25v8l6-3V22l-6 3z" className={fillHi} />
      <path d="M30 19v8l6 3V22l-6-3z" className={fillMid} />
    </PreviewSvg>
  );
}

export function PreviewScatter({ className, quadrant = false, multi = false }: SvgProps & { quadrant?: boolean; multi?: boolean }) {
  return (
    <PreviewSvg className={className}>
      {quadrant ? (
        <>
          <line x1="24" y1="10" x2="24" y2="38" className={strokeDim} />
          <line x1="10" y1="24" x2="38" y2="24" className={strokeDim} />
        </>
      ) : null}
      {[
        [14, 28],
        [20, 18],
        [30, 26],
        ...(multi ? [[34, 14], [16, 34]] : []),
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.5" className={fillHi} />
      ))}
    </PreviewSvg>
  );
}

export function PreviewFunnel({ className }: SvgProps) {
  return (
    <PreviewSvg className={className}>
      <path d="M12 12h24l-4 8H16l-4 8h20l-4 8H12z" className={fillMid} />
    </PreviewSvg>
  );
}

export function PreviewSankey({ className }: SvgProps) {
  return (
    <PreviewSvg className={className}>
      <rect x="10" y="14" width="4" height="20" className={fillHi} />
      <rect x="34" y="12" width="4" height="10" className={fillMid} />
      <rect x="34" y="26" width="4" height="10" className={fillLo} />
      <path d="M14 18 C22 18 26 16 34 16" className={cn(strokeHi, "opacity-60")} />
      <path d="M14 30 C22 30 26 32 34 32" className={cn(strokeHi, "opacity-45")} />
    </PreviewSvg>
  );
}

export function PreviewGraph({ className }: SvgProps) {
  return (
    <PreviewSvg className={className}>
      <circle cx="24" cy="16" r="3" className={fillHi} />
      <circle cx="14" cy="30" r="3" className={fillMid} />
      <circle cx="34" cy="30" r="3" className={fillLo} />
      <line x1="24" y1="19" x2="14" y2="27" className={strokeDim} />
      <line x1="24" y1="19" x2="34" y2="27" className={strokeDim} />
    </PreviewSvg>
  );
}

export function PreviewCirclePacking({ className }: SvgProps) {
  return (
    <PreviewSvg className={className}>
      <circle cx="24" cy="24" r="12" className={fillLo} />
      <circle cx="18" cy="20" r="5" className={fillMid} />
      <circle cx="30" cy="26" r="4" className={fillHi} />
    </PreviewSvg>
  );
}

export function PreviewMix({
  className,
  grouped = false,
  stacked = false,
  dualLine = false,
}: SvgProps & { grouped?: boolean; stacked?: boolean; dualLine?: boolean }) {
  if (dualLine) {
    return (
      <PreviewSvg className={className}>
        <path d="M8 30 L18 22 L28 26 L40 18" className={cn(strokeHi, "stroke-[2.5]")} />
        <path d="M8 20 L18 26 L28 18 L40 24" className={cn(strokeMid, "stroke-[2.5]")} strokeDasharray="4 3" />
      </PreviewSvg>
    );
  }
  return (
    <PreviewSvg className={className}>
      {grouped ? (
        <>
          <rect x="12" y="24" width="4" height="12" className={fillMid} />
          <rect x="18" y="18" width="4" height="18" className={fillHi} />
        </>
      ) : stacked ? (
        <>
          <rect x="14" y="26" width="6" height="10" className={fillLo} />
          <rect x="14" y="18" width="6" height="8" className={fillMid} />
        </>
      ) : (
        <>
          <rect x="14" y="22" width="6" height="14" className={fillMid} />
          <rect x="24" y="16" width="6" height="20" className={fillHi} />
        </>
      )}
      <path d="M10 14 L20 18 L30 12 L38 16" className={cn(strokeHi, "stroke-[2.5]")} />
    </PreviewSvg>
  );
}
