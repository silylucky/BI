import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiRequestError,
  apiFetch,
  getAuthHeaders,
  isEmbedShareContext,
  isHeadlessAuthContext,
  registerUnauthorizedHandler,
  resetUnauthorizedHandler,
  resolveDatasetExecutePath,
  resolveQueryExecutePath,
} from "@/lib/api";
import { isExportSnapshotContext } from "@/lib/exportSnapshot";
import { getAuthToken, setAuthToken } from "@/lib/auth-token";

const TOKEN = "existing-token";

function mockResponse(body: BodyInit | null, status: number): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(body, {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

function mockJson(body: unknown, status: number): void {
  mockResponse(JSON.stringify(body), status);
}

async function expectApiError(request: Promise<unknown>): Promise<ApiRequestError> {
  try {
    await request;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiRequestError);
    return error as ApiRequestError;
  }
  throw new Error("Expected apiFetch to reject");
}

afterEach(() => {
  resetUnauthorizedHandler();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("apiFetch 401 classification", () => {
  it("fails closed by default and reports an expired session", async () => {
    setAuthToken(TOKEN);
    const onUnauthorized = vi.fn();
    registerUnauthorizedHandler(onUnauthorized);
    mockJson({ message: "业务错误", code: "SOME_BUSINESS_CODE" }, 401);

    const error = await expectApiError(apiFetch("/api/v1/example"));

    expect(getAuthToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({
      message: "登录已过期，请重新登录",
      code: "UNAUTHORIZED",
    });
  });

  it("preserves the session for an exact allowlisted string code", async () => {
    setAuthToken(TOKEN);
    const onUnauthorized = vi.fn();
    registerUnauthorizedHandler(onUnauthorized);
    const fields = [{ field: "current_password", message: "当前密码错误" }];
    mockJson(
      {
        message: "当前密码不正确",
        code: "AUTH_INVALID_CURRENT_PASSWORD",
        detail: { fields },
      },
      401,
    );

    const error = await expectApiError(
      apiFetch("/api/v1/auth/change-password", {
        preserveSessionOn401Codes: ["AUTH_INVALID_CURRENT_PASSWORD"],
      }),
    );

    expect(getAuthToken()).toBe(TOKEN);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(error).toMatchObject({
      message: "当前密码不正确",
      code: "AUTH_INVALID_CURRENT_PASSWORD",
      fields,
    });
  });

  it("fails closed when the returned code is not allowlisted", async () => {
    setAuthToken(TOKEN);
    const onUnauthorized = vi.fn();
    registerUnauthorizedHandler(onUnauthorized);
    mockJson({ message: "令牌已失效", code: "AUTH_TOKEN_INVALID" }, 401);

    const error = await expectApiError(
      apiFetch("/api/v1/auth/change-password", {
        preserveSessionOn401Codes: ["AUTH_INVALID_CURRENT_PASSWORD"],
      }),
    );

    expect(getAuthToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(error.code).toBe("UNAUTHORIZED");
  });

  it.each([
    ["empty body", ""],
    ["invalid JSON", "{"],
  ])("fails closed for a 401 with %s", async (_caseName, body) => {
    setAuthToken(TOKEN);
    const onUnauthorized = vi.fn();
    registerUnauthorizedHandler(onUnauthorized);
    mockResponse(body, 401);

    const error = await expectApiError(
      apiFetch("/api/v1/auth/change-password", {
        preserveSessionOn401Codes: ["AUTH_INVALID_CURRENT_PASSWORD"],
      }),
    );

    expect(getAuthToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(error.code).toBe("UNAUTHORIZED");
  });

  it.each([
    ["numeric code", { message: "错误", code: 42 }],
    ["array code", { message: "错误", code: ["AUTH_INVALID_CURRENT_PASSWORD"] }],
    ["object code", { message: "错误", code: { value: "AUTH_INVALID_CURRENT_PASSWORD" } }],
    ["missing code", { message: "错误" }],
    ["missing message", { code: "AUTH_INVALID_CURRENT_PASSWORD" }],
  ])("fails closed for a 401 with %s", async (_caseName, body) => {
    setAuthToken(TOKEN);
    const onUnauthorized = vi.fn();
    registerUnauthorizedHandler(onUnauthorized);
    mockJson(body, 401);

    const error = await expectApiError(
      apiFetch("/api/v1/auth/change-password", {
        preserveSessionOn401Codes: ["AUTH_INVALID_CURRENT_PASSWORD"],
      }),
    );

    expect(getAuthToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("maps 413 payload too large to PAYLOAD_TOO_LARGE", async () => {
    setAuthToken(TOKEN);
    mockJson({ detail: "Request Entity Too Large" }, 413);

    const error = await expectApiError(
      apiFetch("/api/v1/dashboards/dash-1/editor-save", { method: "PUT", body: "{}" }),
    );

    expect(error).toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
    expect(error.message).toContain("背景图");
  });

  it("maps FastAPI string detail to a readable error", async () => {
    setAuthToken(TOKEN);
    mockJson({ detail: "column surface_kind does not exist" }, 500);

    const error = await expectApiError(apiFetch("/api/v1/dashboards"));

    expect(error).toMatchObject({
      message: "column surface_kind does not exist",
      code: "HTTP_ERROR",
    });
  });

  it("maps FastAPI object detail with code for 409 conflicts", async () => {
    setAuthToken(TOKEN);
    mockJson(
      {
        detail: {
          code: "RUN_ALREADY_IN_PROGRESS",
          message: "该任务正在运行中",
          detail: null,
        },
      },
      409,
    );

    const error = await expectApiError(
      apiFetch("/api/v1/ingestion/sync-jobs/job-1/run", { method: "POST" }),
    );

    expect(error).toMatchObject({
      message: "该任务正在运行中",
      code: "RUN_ALREADY_IN_PROGRESS",
    });
  });

  it("maps plain-text 500 responses to an internal server error", async () => {
    setAuthToken(TOKEN);
    mockResponse("Internal Server Error", 500);

    const error = await expectApiError(apiFetch("/api/v1/dashboards"));

    expect(error).toMatchObject({
      message: "后端服务内部错误，请重启 uvicorn 并查看终端日志",
      code: "INTERNAL_SERVER_ERROR",
    });
  });

  it("keeps the existing error body behavior for non-401 responses", async () => {
    setAuthToken(TOKEN);
    const onUnauthorized = vi.fn();
    registerUnauthorizedHandler(onUnauthorized);
    const fields = [{ field: "name", message: "名称无效" }];
    mockJson(
      { message: "请求校验失败", code: "VALIDATION_ERROR", detail: { fields } },
      422,
    );

    const error = await expectApiError(apiFetch("/api/v1/example"));

    expect(getAuthToken()).toBe(TOKEN);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(error).toMatchObject({
      message: "请求校验失败",
      code: "VALIDATION_ERROR",
      fields,
    });
  });

  it("does not let an older unsubscribe remove a newer handler", async () => {
    const olderHandler = vi.fn();
    const newerHandler = vi.fn();
    const unsubscribeOlder = registerUnauthorizedHandler(olderHandler);
    registerUnauthorizedHandler(newerHandler);
    unsubscribeOlder();
    mockJson({}, 401);

    await expectApiError(apiFetch("/api/v1/example"));

    expect(olderHandler).not.toHaveBeenCalled();
    expect(newerHandler).toHaveBeenCalledTimes(1);
  });

  it("reset removes every previously registered handler without disabling token clearing", async () => {
    setAuthToken(TOKEN);
    const staleHandler = vi.fn();
    registerUnauthorizedHandler(staleHandler);
    resetUnauthorizedHandler();
    mockJson({}, 401);

    const error = await expectApiError(apiFetch("/api/v1/example"));

    expect(getAuthToken()).toBeNull();
    expect(staleHandler).not.toHaveBeenCalled();
    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("does not pass apiFetch-only options to native fetch", async () => {
    mockJson({ ok: true }, 200);

    await apiFetch("/api/v1/example", {
      method: "POST",
      preserveSessionOn401Codes: ["AUTH_INVALID_CURRENT_PASSWORD"],
    });

    const fetchOptions = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(fetchOptions).toMatchObject({ method: "POST" });
    expect(fetchOptions).not.toHaveProperty("preserveSessionOn401Codes");
  });
});

describe("embed share auth", () => {
  const embedLocation = {
    pathname: "/embed/screen/d1",
    search: "?token=embed-public-token&shareMode=public",
    href: "http://localhost:5173/embed/screen/d1?token=embed-public-token&shareMode=public",
  };

  it("prefers embed token over stale bearer on embed URLs", () => {
    vi.stubGlobal("location", embedLocation);
    setAuthToken("stale-jwt");
    expect(getAuthHeaders()).toEqual({ "X-Embed-Token": "embed-public-token" });
    expect(isEmbedShareContext()).toBe(true);
  });

  it("does not redirect to login on 401 when embed token is present", async () => {
    vi.stubGlobal("location", embedLocation);
    setAuthToken("stale-jwt");
    const onUnauthorized = vi.fn();
    registerUnauthorizedHandler(onUnauthorized);
    mockJson({ message: "Invalid embed token", code: "EMBED_TOKEN_INVALID" }, 401);

    const error = await expectApiError(apiFetch("/api/v1/embed/query/execute"));

    expect(getAuthToken()).toBe("stale-jwt");
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(error.code).toBe("EMBED_TOKEN_INVALID");
  });

  it("detects embed context when app is mounted under basename", () => {
    vi.stubGlobal("location", {
      pathname: "/vs/embed/screen/d1",
      search: "?token=embed-public-token&shareMode=public",
      href: "http://localhost:5173/vs/embed/screen/d1?token=embed-public-token&shareMode=public",
    });
    vi.stubEnv("BASE_URL", "/vs/");
    setAuthToken("stale-jwt");
    expect(isEmbedShareContext()).toBe(true);
    expect(getAuthHeaders()).toEqual({ "X-Embed-Token": "embed-public-token" });
    expect(resolveDatasetExecutePath()).toBe("/api/v1/embed/dataset/execute");
    expect(resolveQueryExecutePath()).toBe("/api/v1/embed/query/execute");
  });
});

describe("export snapshot auth", () => {
  const exportLocation = {
    pathname: "/export/dashboard/d1",
    search: "?token=export-public-token",
    href: "http://localhost:5173/export/dashboard/d1?token=export-public-token",
  };

  it("prefers export token headers on export snapshot URLs", () => {
    vi.stubGlobal("location", exportLocation);
    setAuthToken("stale-jwt");
    expect(getAuthHeaders()).toEqual({
      "X-Export-Token": "export-public-token",
      "X-Export-Dashboard-Id": "d1",
    });
    expect(isExportSnapshotContext()).toBe(true);
    expect(isHeadlessAuthContext()).toBe(true);
  });

  it("does not redirect to login on 401 when export token is present", async () => {
    vi.stubGlobal("location", exportLocation);
    setAuthToken("stale-jwt");
    const onUnauthorized = vi.fn();
    registerUnauthorizedHandler(onUnauthorized);
    mockJson({ message: "Invalid export token", code: "EXPORT_TOKEN_INVALID" }, 401);

    const error = await expectApiError(apiFetch("/api/v1/dashboards/export-query/execute"));

    expect(getAuthToken()).toBe("stale-jwt");
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(error.code).toBe("EXPORT_TOKEN_INVALID");
  });

  it("resolves dataset execute to export-query path on snapshot pages", async () => {
    vi.stubGlobal("location", exportLocation);
    expect(resolveDatasetExecutePath()).toBe("/api/v1/dashboards/export-query/dataset/execute");
    expect(resolveQueryExecutePath()).toBe("/api/v1/dashboards/export-query/execute");
  });
});
