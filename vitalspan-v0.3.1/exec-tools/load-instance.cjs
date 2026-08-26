"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/exec-tools/load-instance.ts
var load_instance_exports = {};
__export(load_instance_exports, {
  run: () => run
});
module.exports = __toCommonJS(load_instance_exports);
function resolveApiBase(params) {
  const raw = params.apiBaseUrl ?? params.baseUrl ?? process.env.VITALSPAN_API ?? "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (trimmed) return trimmed;
  return "http://127.0.0.1:8000/api/v1";
}
function resolveFeAdmin(params) {
  const raw = params.feAdminUrl ?? process.env.VITALSPAN_FE ?? "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (trimmed) return trimmed;
  return "http://127.0.0.1:5173/admin";
}
async function requestJson(method, url, body, token, signal) {
  const headers = { Accept: "application/json" };
  if (body !== void 0) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body === void 0 ? void 0 : JSON.stringify(body),
    signal
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${url} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  if (res.status === 204 || !text) return {};
  return JSON.parse(text);
}
async function login(apiBase, signal) {
  const username = process.env.VITALSPAN_USERNAME ?? "admin";
  const password = process.env.VITALSPAN_DEV_ADMIN_PASSWORD ?? "changeme";
  const data = await requestJson(
    "POST",
    `${apiBase}/auth/login`,
    { username, password },
    void 0,
    signal
  );
  const token = data.accessToken ?? data.access_token;
  if (!token) throw new Error("login missing accessToken");
  return token;
}
async function run(params, ctx) {
  ctx.signal?.throwIfAborted();
  const apiBaseUrl = resolveApiBase(params);
  const feAdminUrl = resolveFeAdmin(params);
  const limit = Math.min(Math.max(Number(params.limit ?? 50), 1), 100);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6e4);
  const linked = ctx.signal;
  linked?.addEventListener("abort", () => controller.abort(), { once: true });
  try {
    const token = await login(apiBaseUrl, controller.signal);
    const artifactsData = await requestJson(
      "GET",
      `${apiBaseUrl}/ai-viz/artifacts?limit=${limit}&offset=0`,
      void 0,
      token,
      controller.signal
    );
    const dashboardsData = await requestJson(
      "GET",
      `${apiBaseUrl}/dashboards?limit=${limit}&offset=0`,
      void 0,
      token,
      controller.signal
    );
    const artifacts = (artifactsData.items ?? []).map((item) => {
      const manifest = item.manifest ?? {};
      return {
        id: String(item.artifactId ?? item.artifact_id ?? ""),
        name: String(manifest.displayName ?? manifest.id ?? "?"),
        tier: String(item.styleComplianceTier ?? item.style_compliance_tier ?? "")
      };
    });
    const dashboards = (dashboardsData.items ?? []).map((item) => ({
      id: String(item.id ?? ""),
      name: String(item.name ?? "?"),
      surfaceKind: typeof item.surfaceKind === "string" ? item.surfaceKind : void 0
    }));
    return {
      ok: true,
      instanceId: params.instanceId,
      apiBaseUrl,
      feAdminUrl,
      artifacts,
      dashboards
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, apiBaseUrl, feAdminUrl, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  run
});
