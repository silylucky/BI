/** Vite `base` / React Router basename helpers (export & embed path detection). */

function normalizeBasePath(raw: string): string {
  if (raw === "/") return "";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export function getAppBasePath(): string {
  return normalizeBasePath(import.meta.env.BASE_URL ?? "/");
}

/**
 * 解析 `public/` 静态资源 URL（template-assets、geo 等）。
 * 仅使用 Vite `BASE_URL`，与 API 基址无关；对已带 base 前缀的路径幂等。
 */
export function resolvePublicAssetUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) return trimmed;
  const base = getAppBasePath();
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (base && (normalized === base || normalized.startsWith(`${base}/`))) {
    return normalized;
  }
  return `${base}${normalized}`;
}

/** dev / 同源部署时 API 前缀；显式 `VITE_API_BASE_URL` 优先（含空串表示同源相对路径） */
export function resolveApiBaseUrl(): string {
  const env = import.meta.env as ImportMetaEnv & { VITE_API_BASE_URL?: string };
  if (env.VITE_API_BASE_URL !== undefined) {
    return env.VITE_API_BASE_URL;
  }
  if (import.meta.env.DEV) return getAppBasePath();
  return getAppBasePath();
}

export function stripAppBase(pathname: string): string {
  const base = getAppBasePath();
  if (!base) return pathname;
  if (pathname === base) return "/";
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length);
  return pathname;
}

export function isExportSnapshotPath(pathname?: string): boolean {
  const path = stripAppBase(pathname ?? (typeof window !== "undefined" ? window.location.pathname : ""));
  return path.startsWith("/export/");
}

export function matchExportDashboardId(pathname?: string): string | null {
  const path = stripAppBase(pathname ?? (typeof window !== "undefined" ? window.location.pathname : ""));
  const match = path.match(/^\/export\/(?:dashboard|data-screen)\/([^/]+)/);
  return match?.[1] ?? null;
}

export function isEmbedPath(pathname?: string): boolean {
  const path = stripAppBase(pathname ?? (typeof window !== "undefined" ? window.location.pathname : ""));
  return path.startsWith("/embed/");
}

/** 将后端返回的 `/embed/...` 路径拼成可访问的完整分享 URL（含 Vite base）。 */
export function buildEmbedShareUrl(embedPath: string): string {
  if (typeof window === "undefined") return embedPath;
  const trimmed = embedPath.trim();
  if (!trimmed) return window.location.origin;
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const base = getAppBasePath();
  const withBase = base && !path.startsWith(`${base}/`) ? `${base}${path}` : path;
  return `${window.location.origin}${withBase}`;
}
