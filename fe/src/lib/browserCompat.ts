export type CompatResult = { supported: boolean; status: string; warnings: string[] };

export function checkBrowserCompat(): CompatResult {
  const warnings: string[] = [];
  let supported = true;
  if (typeof Promise === "undefined") {
    supported = false;
    warnings.push("缺少 Promise");
  }
  if (typeof fetch === "undefined") {
    supported = false;
    warnings.push("缺少 fetch");
  }
  if (typeof ResizeObserver === "undefined") {
    warnings.push("ResizeObserver 不可用");
  }
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/MSIE |Trident\//.test(ua)) {
    supported = false;
    warnings.push("Internet Explorer 不受支持");
  }
  return { supported, status: supported ? "supported" : "unsupported", warnings };
}
