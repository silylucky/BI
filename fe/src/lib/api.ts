import { isEmbedPath, matchExportDashboardId, resolveApiBaseUrl } from "@/lib/appBasePath";
import { clearAuthToken, getAuthToken } from "@/lib/auth-token";
import {
  getExportAuthHeaders,
  isExportSnapshotContext,
  resolveExportQueryExecutePath,
} from "@/lib/exportSnapshot";

let onUnauthorized: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: () => void): () => void {
  onUnauthorized = handler;
  return () => {
    if (onUnauthorized === handler) {
      onUnauthorized = null;
    }
  };
}

export function resetUnauthorizedHandler(): void {
  onUnauthorized = null;
}

export function getEmbedTokenFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("token");
}

export function isEmbedShareContext(): boolean {
  if (typeof window === "undefined") return false;
  if (!isEmbedPath()) return false;
  return Boolean(getEmbedTokenFromLocation());
}

export function getAuthHeaders(): Record<string, string> {
  if (isExportSnapshotContext()) {
    const dashboardId = matchExportDashboardId();
    if (dashboardId) return getExportAuthHeaders(dashboardId);
  }
  if (isEmbedShareContext()) {
    const embedToken = getEmbedTokenFromLocation();
    if (embedToken) return { "X-Embed-Token": embedToken };
  }
  const token = getAuthToken();
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

export function resolveQueryExecutePath(): string {
  if (isExportSnapshotContext()) return resolveExportQueryExecutePath();
  if (isEmbedShareContext()) return "/api/v1/embed/query/execute";
  return "/api/v1/query/execute";
}

export function resolveDatasetExecutePath(): string {
  if (isExportSnapshotContext()) {
    return "/api/v1/dashboards/export-query/dataset/execute";
  }
  if (isEmbedShareContext()) return "/api/v1/embed/dataset/execute";
  return "/api/v1/query/dataset/execute";
}

/** Embed / 导出快照页：401 不得清会话并踢登录，否则无头渲染会丢 `data-export-ready` */
export function isHeadlessAuthContext(): boolean {
  return isEmbedShareContext() || isExportSnapshotContext();
}

export class ApiRequestError extends Error {
  code?: string;
  fields?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    code?: string,
    fields?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.fields = fields;
  }
}

export type ApiEnvelope<T> = {
  code?: number | string;
  message?: string;
  data?: T;
} & T;

export interface ApiFetchOptions extends RequestInit {
  preserveSessionOn401Codes?: readonly string[];
}

type ApiErrorBody = {
  message?: string;
  code?: string;
  fields?: Array<{ field: string; message: string }>;
};

const API_BASE = resolveApiBaseUrl();

export const API_FETCH_TIMEOUT_MS = 30_000;

export async function fetchWithTimeout(
  input: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = API_FETCH_TIMEOUT_MS, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiRequestError(
        "请求超时，请确认后端服务（uvicorn）与数据库已启动",
        "REQUEST_TIMEOUT",
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function parseErrorBody(response: Response): Promise<ApiErrorBody | null> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return null;
  }
  const trimmed = text.trim();
  if (!trimmed) return null;

  let body: unknown;
  try {
    body = JSON.parse(trimmed) as unknown;
  } catch {
    if (/internal server error/i.test(trimmed)) {
      return {
        message: "后端服务内部错误，请重启 uvicorn 并查看终端日志",
        code: "INTERNAL_SERVER_ERROR",
      };
    }
    if (/did you mean to visit/i.test(trimmed) || trimmed.startsWith("<")) {
      return {
        message: "API 请求路径与前端 base 不一致，请确认 dev 代理或 VITE_FE_BASE_PATH 配置",
        code: "HTTP_ERROR",
      };
    }
    return { message: trimmed.slice(0, 200), code: "HTTP_ERROR" };
  }

  if (!isRecord(body)) return null;

  if (Array.isArray(body.detail)) {
    const fields = body.detail
      .map((item) => {
        if (!isRecord(item)) return null;
        const loc = Array.isArray(item.loc)
          ? item.loc.filter((part) => typeof part === "string").join(".")
          : "";
        const message = typeof item.msg === "string" ? item.msg : "";
        if (!message) return null;
        return { field: loc || "detail", message };
      })
      .filter((item): item is { field: string; message: string } => item !== null);
    const first = fields[0];
    return {
      message: first ? `${first.field}: ${first.message}` : undefined,
      code: typeof body.code === "string" ? body.code : "VALIDATION_ERROR",
      fields: fields.length > 0 ? fields : undefined,
    };
  }

  const detail = isRecord(body.detail) ? body.detail : null;
  const detailMessage =
    typeof body.detail === "string" && body.detail.trim() ? body.detail.trim() : undefined;
  const detailCode = typeof detail?.code === "string" ? detail.code : undefined;
  const detailNestedMessage =
    typeof detail?.message === "string" && detail.message.trim() ? detail.message.trim() : undefined;
  const message =
    typeof body.message === "string" && body.message.trim()
      ? body.message
      : detailNestedMessage ?? detailMessage;
  return {
    message,
    code:
      typeof body.code === "string"
        ? body.code
        : detailCode ?? (message ? "HTTP_ERROR" : undefined),
    fields: Array.isArray(detail?.fields)
      ? (detail.fields as Array<{ field: string; message: string }>)
      : undefined,
  };
}

function toApiRequestError(body: ApiErrorBody | null): ApiRequestError {
  return new ApiRequestError(
    body?.message ?? "操作失败，请稍后重试",
    body?.code,
    body?.fields,
  );
}

export async function apiFetch<T>(
  path: string,
  init: ApiFetchOptions = {},
): Promise<T> {
  const { preserveSessionOn401Codes, ...fetchInit } = init;
  const response = await fetchWithTimeout(`${API_BASE}${path}`, {
    ...fetchInit,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(fetchInit.headers ?? {}),
    },
  });
  if (response.status === 401) {
    const body = await parseErrorBody(response);
    const preservesSession =
      body?.message !== undefined &&
      body.code !== undefined &&
      preserveSessionOn401Codes?.includes(body.code);
    if (preservesSession) {
      throw toApiRequestError(body);
    }
    if (!isHeadlessAuthContext()) {
      clearAuthToken();
      onUnauthorized?.();
    }
    throw new ApiRequestError(
      isEmbedShareContext()
        ? (body?.message ?? "嵌入令牌无效或已过期")
        : isExportSnapshotContext()
          ? (body?.message ?? "导出令牌无效或已过期")
          : "登录已过期，请重新登录",
      isEmbedShareContext()
        ? body?.code === "UNAUTHORIZED"
          ? "EMBED_UNAUTHORIZED"
          : (body?.code ?? "EMBED_UNAUTHORIZED")
        : isExportSnapshotContext()
          ? body?.code === "UNAUTHORIZED"
            ? "EXPORT_UNAUTHORIZED"
            : (body?.code ?? "EXPORT_UNAUTHORIZED")
          : "UNAUTHORIZED",
    );
  }
  if (!response.ok) {
    if (response.status === 413) {
      throw new ApiRequestError(
        "保存数据过大（常见原因：自定义背景图过大），请压缩图片或移除背景图后再保存",
        "PAYLOAD_TOO_LARGE",
      );
    }
    throw toApiRequestError(await parseErrorBody(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text.trim()) {
    return undefined as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiRequestError(
      /did you mean to visit/i.test(text) || text.trimStart().startsWith("<")
        ? "API 请求路径与前端 base 不一致，请确认 VITE_FE_BASE_PATH 与访问地址一致，或重启 pnpm dev"
        : `API 返回非 JSON（${response.status}）`,
      "HTTP_ERROR",
    );
  }
}
