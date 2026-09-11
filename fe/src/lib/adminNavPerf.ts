const PREFIX = "admin-nav";

/** 侧栏导航开始（pathname 变化时调用） */
export function markAdminNavStart(path: string): void {
  if (typeof performance === "undefined") return;
  performance.mark(`${PREFIX}:start:${path}`);
}

/** 目标路由壳层首帧绘制完成 */
export function markAdminNavShellReady(path: string): void {
  if (typeof performance === "undefined") return;
  const startMark = `${PREFIX}:start:${path}`;
  const shellMark = `${PREFIX}:shell:${path}`;
  performance.mark(shellMark);
  try {
    const measureName = `${PREFIX}:shell-ms:${path}`;
    performance.measure(measureName, startMark, shellMark);
    if (import.meta.env.DEV) {
      const entry = performance.getEntriesByName(measureName).at(-1);
      if (entry) {
        console.debug(`[admin-nav] shell ready ${path}: ${entry.duration.toFixed(1)}ms`);
      }
    }
  } catch {
    // start mark may be missing on first paint
  }
}

export function clearAdminNavMeasures(path: string): void {
  if (typeof performance === "undefined") return;
  for (const name of [
    `${PREFIX}:start:${path}`,
    `${PREFIX}:shell:${path}`,
    `${PREFIX}:shell-ms:${path}`,
  ]) {
    performance.clearMarks(name);
    performance.clearMeasures(name);
  }
}
