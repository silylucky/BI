import { finalizeEmbeddedChartSvgs } from "@/components/charts/engine/d3/core/sceneGraph";

/** 管理单容器 D3 渲染 teardown（力导向 simulation、transition 等） */
const cleanupMap = new WeakMap<HTMLElement, () => void>();

export function runD3Renderer(
  container: HTMLElement,
  render: () => (() => void) | undefined,
): void {
  cleanupMap.get(container)?.();
  const cleanup = render();
  finalizeEmbeddedChartSvgs(container);
  cleanupMap.set(container, cleanup ?? (() => undefined));
}

export function disposeD3Renderer(container: HTMLElement | null): void {
  if (!container) return;
  cleanupMap.get(container)?.();
  cleanupMap.delete(container);
}
