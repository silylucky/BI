export type RestApiAuthMode = "none" | "basic" | "bearer" | "oauth2";

export type RestApiCompanionState = {
  baseUrl: string;
  authMode: RestApiAuthMode;
  username: string;
  password: string;
  healthPath: string;
  connectTimeoutSec: number;
};

export const defaultRestApiCompanion = (): RestApiCompanionState => ({
  baseUrl: "",
  authMode: "none",
  username: "",
  password: "",
  healthPath: "/",
  connectTimeoutSec: 5,
});

/** 新建向导选 REST API 时的内置样例 API 默认值（本地后端 /sample-api）。 */
export const sampleRestApiCompanionDefaults = (): RestApiCompanionState => ({
  baseUrl: "http://127.0.0.1:8000",
  authMode: "none",
  username: "",
  password: "",
  healthPath: "/sample-api/health",
  connectTimeoutSec: 5,
});

export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** 保存前校验：禁止把连接标识当成 Base URL。 */
export function validateRestApiBaseUrl(baseUrl: string): string | null {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return "请填写 Base URL";
  try {
    const u = new URL(normalized);
    const host = u.hostname.toLowerCase();
    if (!host) return "Base URL 无效";
    const looksLikeHost =
      host === "localhost" ||
      host === "127.0.0.1" ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
      host.includes(".");
    if (!looksLikeHost) {
      return "Base URL 须为可访问的地址（如 http://127.0.0.1:8000），不可填写连接标识";
    }
    return null;
  } catch {
    return "Base URL 格式无效";
  }
}

export function derivePortFromBaseUrl(baseUrl: string): number {
  const normalized = normalizeBaseUrl(baseUrl);
  try {
    const u = new URL(normalized);
    if (u.port) return Number(u.port);
    return u.protocol === "http:" ? 80 : 443;
  } catch {
    return 443;
  }
}

type BaseFormSlice = {
  name: string;
  code: string;
  type: string;
  description: string;
};

export function buildRestApiPayload(
  form: BaseFormSlice,
  companion: RestApiCompanionState,
  mode: "create" | "edit",
  passwordFromForm: string,
): Record<string, unknown> {
  const host = normalizeBaseUrl(companion.baseUrl);
  const port = derivePortFromBaseUrl(host);
  const rawPath = companion.healthPath.trim() || "/";
  const database = (rawPath.startsWith("/") ? rawPath : `/${rawPath}`).replace(/\/+/g, "/");

  let username = "";
  let password = mode === "create" ? passwordFromForm : passwordFromForm || undefined;

  if (companion.authMode === "basic") {
    username = companion.username;
    password = companion.password;
  } else if (companion.authMode === "bearer") {
    username = "bearer";
    password = companion.password;
  } else if (companion.authMode === "none") {
    username = "none";
    password = mode === "create" ? "-" : passwordFromForm || undefined;
  } else {
    username = "oauth2";
    password = mode === "create" ? "-" : passwordFromForm || undefined;
  }

  const payload: Record<string, unknown> = {
    name: form.name,
    type: form.type,
    host,
    port,
    database,
    username,
    description: form.description || null,
    connectionOptions: {
      connectTimeoutSec: companion.connectTimeoutSec,
      restAuthMode: companion.authMode,
    },
  };
  if (mode === "create") {
    payload.code = form.code;
    payload.password = password;
  } else if (password) {
    payload.password = password;
  }
  return payload;
}

export type RoapiCompanionState = {
  baseUrl: string;
  bearerToken: string;
  schemaPath: string;
  connectTimeoutSec: number;
};

export const defaultRoapiCompanion = (): RoapiCompanionState => ({
  baseUrl: "",
  bearerToken: "",
  schemaPath: "/api/schema",
  connectTimeoutSec: 5,
});

/** 新建向导选 RoAPI 时的本地 compose 默认值。 */
export const sampleRoapiCompanionDefaults = (): RoapiCompanionState => ({
  baseUrl: "http://127.0.0.1:8086",
  bearerToken: "",
  schemaPath: "/api/schema",
  connectTimeoutSec: 5,
});

export function buildRoapiPayload(
  form: BaseFormSlice,
  companion: RoapiCompanionState,
  mode: "create" | "edit",
  passwordFromForm: string,
): Record<string, unknown> {
  const host = normalizeBaseUrl(companion.baseUrl);
  const port = derivePortFromBaseUrl(host);
  const rawPath = companion.schemaPath.trim() || "/api/schema";
  const database = (rawPath.startsWith("/") ? rawPath : `/${rawPath}`).replace(/\/+/g, "/");
  const hasBearer = Boolean(companion.bearerToken.trim());
  const username = hasBearer ? "bearer" : "none";
  const password = hasBearer
    ? companion.bearerToken
    : mode === "create"
      ? "-"
      : passwordFromForm || undefined;

  const payload: Record<string, unknown> = {
    name: form.name,
    type: form.type,
    host,
    port,
    database,
    username,
    description: form.description || null,
    connectionOptions: {
      connectTimeoutSec: companion.connectTimeoutSec,
    },
  };
  if (mode === "create") {
    payload.code = form.code;
    payload.password = password;
  } else if (password) {
    payload.password = password;
  }
  return payload;
}

export type FileSourceMode = "remote" | "local";

export type FileSourceCompanionState = {
  mode: FileSourceMode;
  remoteUrl: string;
  serverPath: string;
  sheetName: string;
  selectedFileName: string;
  fileError: string | null;
};

export const defaultFileSourceCompanion = (): FileSourceCompanionState => ({
  mode: "remote",
  remoteUrl: "",
  serverPath: "",
  sheetName: "",
  selectedFileName: "",
  fileError: null,
});

const FILE_PLACEHOLDER_USER = "file";
const FILE_PLACEHOLDER_PASS = "-";

export function buildFileSourcePayload(
  form: BaseFormSlice,
  companion: FileSourceCompanionState,
  mode: "create" | "edit",
  passwordFromForm: string,
): Record<string, unknown> {
  const host =
    companion.mode === "remote"
      ? companion.remoteUrl.trim()
      : companion.serverPath.trim();

  const payload: Record<string, unknown> = {
    name: form.name,
    type: form.type,
    host,
    port: 1,
    database: companion.sheetName || "",
    username: FILE_PLACEHOLDER_USER,
    description: form.description || null,
  };
  if (mode === "create") {
    payload.code = form.code;
    payload.password = FILE_PLACEHOLDER_PASS;
  } else if (passwordFromForm) {
    payload.password = passwordFromForm;
  }
  return payload;
}

export function validateFileExtension(filename: string, sourceType: "excel" | "csv"): string | null {
  const lower = filename.toLowerCase();
  if (sourceType === "excel") {
    return lower.endsWith(".xlsx") || lower.endsWith(".xls") ? null : "仅支持 .xlsx 或 .xls 文件";
  }
  return lower.endsWith(".csv") ? null : "仅支持 .csv 文件";
}

export const FILE_SIZE_WARN_BYTES = 50 * 1024 * 1024;
