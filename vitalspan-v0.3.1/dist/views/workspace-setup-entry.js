"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const instanceConfig_1 = require("../instanceConfig");
const hostBridge_1 = require("../hostBridge");
const DEFAULT_API = "http://127.0.0.1:8000/api/v1";
const DEFAULT_FE = "http://127.0.0.1:5173/admin";
function render() {
    const root = document.getElementById("vs-setup-root");
    if (!root)
        return;
    root.replaceChildren();
    const data = (0, hostBridge_1.readPluginViewData)();
    if (data.phase !== "workspace-create") {
        root.textContent = "等待工作区创建向导…";
        return;
    }
    if (!window.__pluginViewAction) {
        root.textContent = "宿主桥接不可用（__pluginViewAction 缺失）";
        return;
    }
    const ic = data.instanceConfig ?? {};
    const vs = (ic.vitalspan ?? {});
    const form = document.createElement("form");
    form.style.cssText =
        "font-family:system-ui,sans-serif;padding:12px;max-width:420px;display:flex;flex-direction:column;gap:10px;";
    const apiInput = document.createElement("input");
    apiInput.type = "url";
    apiInput.required = true;
    apiInput.value = String(vs.apiBaseUrl ?? DEFAULT_API);
    apiInput.placeholder = "API 根地址";
    form.appendChild(label("API 地址（/api/v1）", apiInput));
    const feInput = document.createElement("input");
    feInput.type = "url";
    feInput.required = true;
    feInput.value = String(vs.feAdminUrl ?? DEFAULT_FE);
    feInput.placeholder = "5173 管理面";
    form.appendChild(label("前端管理面", feInput));
    const modeSelect = document.createElement("select");
    for (const m of ["demo", "live"]) {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m === "demo" ? "演示" : "生产";
        if ((vs.mode ?? "demo") === m)
            opt.selected = true;
        modeSelect.appendChild(opt);
    }
    form.appendChild(label("模式", modeSelect));
    const err = document.createElement("div");
    err.style.color = "#b91c1c";
    err.style.fontSize = "13px";
    form.appendChild(err);
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "确认 VitalSpan 绑定";
    submit.style.cssText =
        "padding:8px 12px;border-radius:6px;border:none;background:#2563eb;color:#fff;cursor:pointer;";
    form.appendChild(submit);
    form.onsubmit = (e) => {
        e.preventDefault();
        err.textContent = "";
        const binding = {
            mode: modeSelect.value,
            apiBaseUrl: apiInput.value.trim().replace(/\/+$/, ""),
            feAdminUrl: feInput.value.trim().replace(/\/+$/, ""),
        };
        if (!binding.apiBaseUrl.startsWith("http") || !binding.feAdminUrl.startsWith("http")) {
            err.textContent = "请填写有效的 http(s) 地址";
            return;
        }
        (0, hostBridge_1.completeWorkspaceSetup)((0, instanceConfig_1.buildDefaultInstanceConfig)(binding));
    };
    root.appendChild(form);
}
function label(text, control) {
    const wrap = document.createElement("label");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "4px";
    wrap.style.fontSize = "13px";
    const span = document.createElement("span");
    span.textContent = text;
    wrap.appendChild(span);
    wrap.appendChild(control);
    return wrap;
}
function boot() {
    const root = document.createElement("div");
    root.id = "vs-setup-root";
    document.body.replaceChildren(root);
    render();
    (0, hostBridge_1.subscribePluginViewData)(render);
}
boot();
