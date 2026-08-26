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

// src/exec-tools/vitalspan-health.ts
var vitalspan_health_exports = {};
__export(vitalspan_health_exports, {
  run: () => run
});
module.exports = __toCommonJS(vitalspan_health_exports);
function resolveApiBase(params) {
  const fromParams = params.apiBaseUrl?.trim().replace(/\/+$/, "");
  if (fromParams) return fromParams;
  const fromEnv = process.env.VITALSPAN_API?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  return "http://127.0.0.1:8000/api/v1";
}
async function run(params, ctx) {
  ctx.signal?.throwIfAborted();
  const apiBase = resolveApiBase(params);
  const healthRoot = apiBase.replace(/\/api\/v1$/, "");
  const healthUrl = `${healthRoot}/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15e3);
  const linked = ctx.signal;
  linked?.addEventListener("abort", () => controller.abort(), { once: true });
  try {
    const res = await fetch(healthUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, apiBase, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    let status = "";
    try {
      status = JSON.parse(text).status ?? "";
    } catch {
      return { ok: false, apiBase, error: "invalid health JSON" };
    }
    if (status !== "ok") {
      return { ok: false, apiBase, error: `health status=${status}` };
    }
    return { ok: true, healthUrl, apiBase };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, apiBase, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  run
});
