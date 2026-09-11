type ScrollSnapshot = { top: number; left: number };

let pendingRestore: ScrollSnapshot | null = null;

function queryCanvasHost(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="pixel-canvas-host"]');
}

function restoreIfNeeded(host: HTMLElement, saved: ScrollSnapshot): boolean {
  let restored = false;
  if (host.scrollTop < saved.top - 8) {
    host.scrollTop = saved.top;
    restored = true;
  }
  if (host.scrollLeft !== saved.left) {
    host.scrollLeft = saved.left;
    restored = true;
  }
  return restored;
}

function scheduleRestore(host: HTMLElement, saved: ScrollSnapshot): void {
  let attempts = 0;
  const tick = () => {
    if (!pendingRestore) return;
    restoreIfNeeded(host, saved);
    if (host.scrollTop >= saved.top - 8) {
      pendingRestore = null;
      return;
    }
    attempts += 1;
    if (attempts < 12) {
      requestAnimationFrame(tick);
    } else {
      pendingRestore = null;
    }
  };
  requestAnimationFrame(tick);
}

/** 在触发可能引起画布重排的回调前后，保持 pixel-canvas-host 的滚动位置 */
export function preservePixelCanvasHostScroll(run: () => void): void {
  const host = queryCanvasHost();
  if (!host) {
    run();
    return;
  }
  const saved: ScrollSnapshot = { top: host.scrollTop, left: host.scrollLeft };
  if (saved.top > 0 || saved.left > 0) {
    pendingRestore = saved;
  }
  run();
  if (pendingRestore) {
    scheduleRestore(host, saved);
  }
}

/** PixelCanvas 在 layout/选中态提交后补一次恢复，覆盖 ResizeObserver 等异步重排 */
export function consumePendingCanvasHostScrollRestore(host: HTMLElement | null): void {
  if (!host || !pendingRestore) return;
  const saved = pendingRestore;
  if (!restoreIfNeeded(host, saved) && host.scrollTop >= saved.top - 8) {
    pendingRestore = null;
  }
}
