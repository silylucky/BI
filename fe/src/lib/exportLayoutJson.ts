import type { DashboardLayoutV2 } from "@/components/dashboard/layoutUtils";

function sanitizeFilename(name: string): string {
  const trimmed = name.trim() || "layout";
  return trimmed.replace(/[^\w\u4e00-\u9fa5-]+/g, "-").replace(/-+/g, "-");
}

export function downloadJsonFile(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadLayoutJson(layout: DashboardLayoutV2, slugOrName: string): void {
  const base = sanitizeFilename(slugOrName);
  downloadJsonFile(layout, `${base}-layout.json`);
}
