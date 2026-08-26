"use strict";
(() => {
  // src/ids.ts
  var PLUGIN_ID = "vitalspan";
  var PLUGIN_VERSION = "0.3.1";
  var TEMPLATE_ID = "vitalspan.bi.default";
  var TEMPLATE_VERSION = "1.0.0";
  var DOMAIN_KEY = "vitalspan";

  // src/instanceConfig.ts
  function buildDefaultInstanceConfig(binding) {
    return {
      plugin: {
        id: PLUGIN_ID,
        version: PLUGIN_VERSION,
        templateId: TEMPLATE_ID,
        templateVersion: TEMPLATE_VERSION
      },
      [DOMAIN_KEY]: binding
    };
  }

  // src/hostBridge.ts
  function readPluginViewData() {
    return window.__pluginViewData ?? {};
  }
  function subscribePluginViewData(onChange) {
    window.addEventListener("pluginview:data", onChange);
    return () => window.removeEventListener("pluginview:data", onChange);
  }
  function completeWorkspaceSetup(instanceConfig) {
    window.__pluginViewAction?.("workspaceSetup.complete", { instanceConfig });
  }

  // src/views/workspace-setup-entry.ts
  var DEFAULT_API = "http://127.0.0.1:8000/api/v1";
  var DEFAULT_FE = "http://127.0.0.1:5173/admin";
  function render() {
    const root = document.getElementById("vs-setup-root");
    if (!root) return;
    root.replaceChildren();
    const data = readPluginViewData();
    if (data.phase !== "workspace-create") {
      root.textContent = "\u7B49\u5F85\u5DE5\u4F5C\u533A\u521B\u5EFA\u5411\u5BFC\u2026";
      return;
    }
    if (!window.__pluginViewAction) {
      root.textContent = "\u5BBF\u4E3B\u6865\u63A5\u4E0D\u53EF\u7528\uFF08__pluginViewAction \u7F3A\u5931\uFF09";
      return;
    }
    const ic = data.instanceConfig ?? {};
    const vs = ic.vitalspan ?? {};
    const form = document.createElement("form");
    form.style.cssText = "font-family:system-ui,sans-serif;padding:12px;max-width:420px;display:flex;flex-direction:column;gap:10px;";
    const apiInput = document.createElement("input");
    apiInput.type = "url";
    apiInput.required = true;
    apiInput.value = String(vs.apiBaseUrl ?? DEFAULT_API);
    apiInput.placeholder = "API \u6839\u5730\u5740";
    form.appendChild(label("API \u5730\u5740\uFF08/api/v1\uFF09", apiInput));
    const feInput = document.createElement("input");
    feInput.type = "url";
    feInput.required = true;
    feInput.value = String(vs.feAdminUrl ?? DEFAULT_FE);
    feInput.placeholder = "5173 \u7BA1\u7406\u9762";
    form.appendChild(label("\u524D\u7AEF\u7BA1\u7406\u9762", feInput));
    const modeSelect = document.createElement("select");
    for (const m of ["demo", "live"]) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m === "demo" ? "\u6F14\u793A" : "\u751F\u4EA7";
      if ((vs.mode ?? "demo") === m) opt.selected = true;
      modeSelect.appendChild(opt);
    }
    form.appendChild(label("\u6A21\u5F0F", modeSelect));
    const err = document.createElement("div");
    err.style.color = "#b91c1c";
    err.style.fontSize = "13px";
    form.appendChild(err);
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "\u786E\u8BA4 VitalSpan \u7ED1\u5B9A";
    submit.style.cssText = "padding:8px 12px;border-radius:6px;border:none;background:#2563eb;color:#fff;cursor:pointer;";
    form.appendChild(submit);
    form.onsubmit = (e) => {
      e.preventDefault();
      err.textContent = "";
      const binding = {
        mode: modeSelect.value,
        apiBaseUrl: apiInput.value.trim().replace(/\/+$/, ""),
        feAdminUrl: feInput.value.trim().replace(/\/+$/, "")
      };
      if (!binding.apiBaseUrl.startsWith("http") || !binding.feAdminUrl.startsWith("http")) {
        err.textContent = "\u8BF7\u586B\u5199\u6709\u6548\u7684 http(s) \u5730\u5740";
        return;
      }
      completeWorkspaceSetup(buildDefaultInstanceConfig(binding));
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
    subscribePluginViewData(render);
  }
  boot();
})();
