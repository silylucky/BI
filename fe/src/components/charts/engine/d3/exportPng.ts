import { exportAntvPngFromContainer } from "@/components/charts/engine/antv/exportPng";

function sanitizeFilename(name: string): string {
  const trimmed = name.trim() || "chart";
  return trimmed.replace(/[^\w\u4e00-\u9fa5-]+/g, "-").replace(/-+/g, "-");
}

function downloadPngDataUrl(dataUrl: string, title: string): void {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = `${sanitizeFilename(title)}.png`;
  anchor.click();
}

/** 从 D3 SVG 容器导出 PNG */
export function exportD3PngFromContainer(container: HTMLElement, title: string): Promise<void> {
  const svg = container.querySelector("svg");
  if (!svg) {
    exportAntvPngFromContainer(container, title);
    return Promise.resolve();
  }

  const clone = svg.cloneNode(true) as SVGSVGElement;
  const bbox = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(bbox.width || Number(svg.getAttribute("width")) || 1));
  const height = Math.max(1, Math.round(bbox.height || Number(svg.getAttribute("height")) || 1));
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("无法创建导出画布"));
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        downloadPngDataUrl(canvas.toDataURL("image/png"), title);
        resolve();
      } catch (err) {
        reject(err instanceof Error ? err : new Error("SVG 转 PNG 失败"));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG 转 PNG 失败"));
    };
    img.src = url;
  });
}
