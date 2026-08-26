"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
function resolveApiBase(params) {
    const fromParams = params.apiBaseUrl?.trim().replace(/\/+$/, "");
    if (fromParams)
        return fromParams;
    const fromEnv = process.env.VITALSPAN_API?.trim().replace(/\/+$/, "");
    if (fromEnv)
        return fromEnv;
    return "http://127.0.0.1:8000/api/v1";
}
async function run(params, ctx) {
    ctx.signal?.throwIfAborted();
    const apiBase = resolveApiBase(params);
    const healthRoot = apiBase.replace(/\/api\/v1$/, "");
    const healthUrl = `${healthRoot}/health`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const linked = ctx.signal;
    linked?.addEventListener("abort", () => controller.abort(), { once: true });
    try {
        const res = await fetch(healthUrl, {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: controller.signal,
        });
        const text = await res.text();
        if (!res.ok) {
            return { ok: false, apiBase, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
        }
        let status = "";
        try {
            status = JSON.parse(text).status ?? "";
        }
        catch {
            return { ok: false, apiBase, error: "invalid health JSON" };
        }
        if (status !== "ok") {
            return { ok: false, apiBase, error: `health status=${status}` };
        }
        return { ok: true, healthUrl, apiBase };
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, apiBase, error: msg };
    }
    finally {
        clearTimeout(timer);
    }
}
