function sanitizeFilename(name: string): string {
  const trimmed = name.trim() || "chart";
  return trimmed.replace(/[^\w\u4e00-\u9fa5-]+/g, "-").replace(/-+/g, "-");
}

/** 从 AntV/G2Plot 容器导出 PNG */
export function exportAntvPngFromContainer(container: HTMLElement, title: string): void {
  const canvas = container.querySelector("canvas");
  if (!canvas) {
    throw new Error("当前预览区无可导出的图表画布");
  }
  const dataUrl = canvas.toDataURL("image/png");
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = `${sanitizeFilename(title)}.png`;
  anchor.click();
}
