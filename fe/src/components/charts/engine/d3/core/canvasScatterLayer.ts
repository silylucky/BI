import { VCDS } from "@/components/charts/engine/d3/core/chartVisualTokens";

type ScatterCanvasPoint = {
  x: number;
  y: number;
  color: string;
};

export function renderScatterCanvasLayer(
  container: HTMLElement,
  points: ScatterCanvasPoint[],
  width: number,
  height: number,
  margin: { left: number; top: number },
): () => void {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const canvas = document.createElement("canvas");
  canvas.className = "vs-scatter-canvas absolute inset-0 pointer-events-none";
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  container.style.position = container.style.position || "relative";
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) return () => canvas.remove();

  ctx.scale(dpr, dpr);
  const r = VCDS.dot.radius + 0.5;
  for (const pt of points) {
    ctx.beginPath();
    ctx.arc(margin.left + pt.x, margin.top + pt.y, r, 0, Math.PI * 2);
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = 0.88;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  return () => canvas.remove();
}
