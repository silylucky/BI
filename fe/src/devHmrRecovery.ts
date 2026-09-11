/** 开发态 Vite HMR 半更新失败时 #root 可能变空；失败则整页刷新恢复。 */
export function setupDevHmrRecovery(): void {
  if (!import.meta.env.DEV || !import.meta.hot) return;

  import.meta.hot.on("vite:error", () => {
    console.warn("[VitalSpan] Vite HMR 失败，即将刷新页面…");
    window.setTimeout(() => window.location.reload(), 80);
  });
}
