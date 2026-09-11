import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/components/charts/engine/d3/core/animate";
import {
  createTrailDustPool,
  tickTrailDustPool,
  trailDustEnvelope,
  trailDustWobbleOffset,
  TRAIL_DUST_POOL_SIZE,
} from "@/lib/borderFlowTrailDust";
import { trailLengthToMaskRadiusPx } from "@/lib/screenBorderSparkle";

type ScreenBorderFlowDustProps = {
  pathD: string;
  color: string;
  speed: number;
  phaseOffset: number;
  trailLengthPx: number;
  boundsMinPx: number;
  opacity?: number;
};

function sampleSvgPath(
  path: SVGPathElement,
  t: number,
): { x: number; y: number; nx: number; ny: number } {
  const len = path.getTotalLength();
  const at = (((t % 1) + 1) % 1) * len;
  const p = path.getPointAtLength(at);
  const ahead = path.getPointAtLength(Math.min(at + 1.2, len));
  const tx = ahead.x - p.x;
  const ty = ahead.y - p.y;
  const mag = Math.hypot(tx, ty) || 1;
  return { x: p.x, y: p.y, nx: -ty / mag, ny: tx / mag };
}

export function ScreenBorderFlowDust({
  pathD,
  color,
  speed,
  phaseOffset,
  trailLengthPx,
  boundsMinPx,
  opacity = 0.32,
}: ScreenBorderFlowDustProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const circlesRef = useRef<SVGCircleElement[]>([]);
  const particlesRef = useRef(createTrailDustPool());
  const spawnAccRef = useRef({ value: 0 });

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.replaceChildren();
    circlesRef.current = Array.from({ length: TRAIL_DUST_POOL_SIZE }, () => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("fill", color);
      circle.setAttribute("r", "0");
      circle.setAttribute("opacity", "0");
      g.appendChild(circle);
      return circle;
    });
  }, [color]);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const path = pathRef.current;
    if (!path) return undefined;

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const pathEl = pathRef.current;
      const circles = circlesRef.current;
      if (!pathEl || circles.length === 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (typeof pathEl.getTotalLength !== "function") {
        return;
      }

      const deltaSec = Math.min(0.05, (now - last) / 1000);
      last = now;
      const pathLen = pathEl.getTotalLength();
      if (pathLen <= 0) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const trailPx = trailLengthToMaskRadiusPx(trailLengthPx, boundsMinPx);
      const trailWidthNorm = Math.min(0.35, trailPx / pathLen);
      const driftAmp = Math.max(pathLen * 0.00035, 1.2);
      const liftAmp = Math.max(boundsMinPx * 0.0025, 0.6);
      const phase = ((now / 1000 / Math.max(speed, 0.1)) + phaseOffset) % 1;

      tickTrailDustPool({
        particles: particlesRef.current,
        phase,
        deltaSec,
        speed,
        trailWidthNorm,
        driftAmp,
        spawnAcc: spawnAccRef,
      });

      for (let i = 0; i < particlesRef.current.length; i++) {
        const p = particlesRef.current[i]!;
        const circle = circles[i]!;
        if (p.life <= 0) {
          circle.setAttribute("r", "0");
          circle.setAttribute("opacity", "0");
          continue;
        }
        const sample = sampleSvgPath(pathEl, p.ringT);
        const { wobble, lift } = trailDustWobbleOffset(p, driftAmp, liftAmp);
        const envelope = trailDustEnvelope(p);
        const cx = sample.x + sample.nx * (p.normalOff + wobble);
        const cy = sample.y + sample.ny * (p.normalOff + wobble) - lift;
        circle.setAttribute("cx", String(cx));
        circle.setAttribute("cy", String(cy));
        circle.setAttribute("r", String(p.size * (0.55 + 0.45 * (p.life / p.maxLife))));
        circle.setAttribute("opacity", String(opacity * envelope));
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [boundsMinPx, opacity, pathD, phaseOffset, speed, trailLengthPx]);

  return (
    <>
      <path ref={pathRef} d={pathD} fill="none" stroke="none" visibility="hidden" aria-hidden />
      <g ref={groupRef} data-screen-border-flow-dust aria-hidden />
    </>
  );
}
