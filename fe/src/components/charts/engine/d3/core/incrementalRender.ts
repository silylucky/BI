/** 增量渲染：live resize 时保留 SVG 根节点 */
export type IncrementalSession = {
  plotType: string;
  width: number;
  height: number;
};

const sessionMap = new WeakMap<HTMLElement, IncrementalSession>();

export function readIncrementalSession(container: HTMLElement): IncrementalSession | undefined {
  return sessionMap.get(container);
}

export function writeIncrementalSession(container: HTMLElement, session: IncrementalSession): void {
  sessionMap.set(container, session);
}

export function canIncrementalResize(
  container: HTMLElement,
  plotType: string,
  width: number,
  height: number,
): boolean {
  const prev = sessionMap.get(container);
  if (!prev) return false;
  return prev.plotType === plotType && prev.width > 0 && prev.height > 0;
}

export function shouldFullRerender(
  container: HTMLElement,
  plotType: string,
  dataRevision: string,
): boolean {
  const prev = sessionMap.get(container);
  if (!prev) return true;
  return prev.plotType !== plotType;
}

export function clearIncrementalSession(container: HTMLElement): void {
  sessionMap.delete(container);
}
