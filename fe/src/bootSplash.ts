declare global {
  interface Window {
    __VS_BOOT__?: { mounted?: boolean };
  }
}

export function reportBootFailure(message: string): void {
  if (window.__VS_BOOT__?.mounted) return;
  const status = document.getElementById("vs-boot-status-text");
  const splash = document.getElementById("vs-boot-splash");
  if (status) status.textContent = message;
  splash?.setAttribute("aria-busy", "false");
}

export function dismissBootSplash(): void {
  window.__VS_BOOT__ = { ...window.__VS_BOOT__, mounted: true };
  document.getElementById("vs-boot-splash")?.remove();
}
