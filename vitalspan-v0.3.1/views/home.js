"use strict";
(() => {
  // src/ids.ts
  var PLUGIN_ID = "vitalspan";
  var PLUGIN_VERSION = "0.3.1";
  var TEMPLATE_ID = "vitalspan.bi.default";
  var TEMPLATE_VERSION = "1.0.0";
  var DOMAIN_KEY = "vitalspan";
  var VIEW_RESOURCES = "resources";
  var EXEC_TOOL_HEALTH = "vitalspan_health";

  // src/instanceConfig.ts
  function isRecord(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
  }
  function normalizeUrl(url, trailingSlash) {
    const trimmed = url.trim().replace(/\/+$/, "");
    return trailingSlash ? `${trimmed}/` : trimmed;
  }
  function parseBinding(raw) {
    if (!isRecord(raw)) return null;
    const mode = raw.mode;
    const apiBaseUrl = raw.apiBaseUrl ?? raw.api_base;
    const feAdminUrl = raw.feAdminUrl ?? raw.fe_base;
    if (mode !== "demo" && mode !== "live") return null;
    if (typeof apiBaseUrl !== "string" || !apiBaseUrl.startsWith("http")) return null;
    if (typeof feAdminUrl !== "string" || !feAdminUrl.startsWith("http")) return null;
    return {
      mode,
      apiBaseUrl: normalizeUrl(apiBaseUrl, false),
      feAdminUrl: normalizeUrl(feAdminUrl, false)
    };
  }
  function readDomainBinding(instanceConfig) {
    if (!isRecord(instanceConfig)) {
      return { ok: false, reason: "\u672A\u7ED1\u5B9A VitalSpan\uFF1A\u8BF7\u5148\u5B8C\u6210\u5DE5\u4F5C\u533A\u521B\u5EFA\u5411\u5BFC" };
    }
    const pluginRaw = instanceConfig.plugin;
    if (!isRecord(pluginRaw)) {
      return { ok: false, reason: "instanceConfig.plugin \u7F3A\u5931" };
    }
    if (pluginRaw.id !== PLUGIN_ID) {
      return { ok: false, reason: `plugin.id \u5E94\u4E3A ${PLUGIN_ID}\uFF0C\u5F53\u524D\u4E3A ${String(pluginRaw.id)}` };
    }
    const binding = parseBinding(instanceConfig[DOMAIN_KEY]);
    if (!binding) {
      return {
        ok: false,
        reason: `instanceConfig.${DOMAIN_KEY} \u65E0\u6548\uFF1A\u9700\u8981 mode(demo|live)\u3001apiBaseUrl\u3001feAdminUrl`
      };
    }
    return {
      ok: true,
      plugin: {
        id: PLUGIN_ID,
        version: typeof pluginRaw.version === "string" ? pluginRaw.version : PLUGIN_VERSION,
        templateId: typeof pluginRaw.templateId === "string" ? pluginRaw.templateId : TEMPLATE_ID,
        templateVersion: typeof pluginRaw.templateVersion === "string" ? pluginRaw.templateVersion : TEMPLATE_VERSION
      },
      binding
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
  function navigateWorkspace(input) {
    window.__pluginViewAction?.("workspace.navigate", input);
  }
  async function pluginExec(toolName, params) {
    if (!window.pluginExec) {
      throw new Error("pluginExec unavailable \u2014 install execTools and restart DeepTalk");
    }
    return await window.pluginExec(toolName, params);
  }

  // src/views/home-entry.ts
  function adminBase(feAdminUrl) {
    return feAdminUrl.trim().replace(/\/+$/, "");
  }
  function el(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function render() {
    const root = document.getElementById("vs-root");
    if (!root) return;
    root.replaceChildren();
    const style = document.createElement("style");
    style.textContent = `
    * { box-sizing: border-box; margin: 0; }
    html, body, #vs-root { height: 100%; }
    body { font-family: system-ui, sans-serif; background: var(--bg-primary, #0f1419); color: var(--fg-primary, #e7ecf1); }
    #vs-root { padding: 24px; overflow: auto; }
    .banner { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; background: #3d1f1f; color: #fecaca; border: 1px solid #7f1d1d; }
    .card { padding: 16px; border-radius: 8px; background: var(--bg-secondary, #1a2332); margin-bottom: 12px; }
    .muted { color: var(--fg-secondary, #94a3b8); font-size: 13px; margin-top: 8px; }
    .btn { display: inline-block; margin-top: 12px; padding: 8px 16px; border-radius: 6px; background: #2563eb; color: #fff; text-decoration: none; cursor: pointer; border: none; font-size: 14px; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .ok { color: #86efac; }
    .err { color: #fca5a5; }
  `;
    root.appendChild(style);
    const data = readPluginViewData();
    const parsed = readDomainBinding(data.instanceConfig);
    if (!parsed.ok) {
      root.appendChild(el("div", parsed.reason, "banner"));
      root.appendChild(
        el("p", "\u8BF7\u5728\u65B0\u5EFA\u5DE5\u4F5C\u533A\u5411\u5BFC\u4E2D\u586B\u5199 VitalSpan API \u4E0E\u524D\u7AEF\u5730\u5740\uFF0C\u6216\u8054\u7CFB\u7BA1\u7406\u5458\u3002", "muted")
      );
      return;
    }
    const { binding } = parsed;
    const card = document.createElement("div");
    card.className = "card";
    card.appendChild(el("h2", "VitalSpan BI \u5DE5\u4F5C\u533A"));
    card.appendChild(el("p", `\u6A21\u5F0F\uFF1A${binding.mode === "demo" ? "\u6F14\u793A" : "\u751F\u4EA7"}`));
    card.appendChild(el("p", `API\uFF1A${binding.apiBaseUrl}`));
    card.appendChild(el("p", `\u7BA1\u7406\u9762\uFF1A${binding.feAdminUrl}`));
    const healthLine = el("p", "\u8FDE\u63A5\u68C0\u6D4B\uFF1A\u5C1A\u672A\u68C0\u67E5", "muted");
    healthLine.id = "vs-health-line";
    card.appendChild(healthLine);
    const openBtn = document.createElement("a");
    openBtn.className = "btn";
    openBtn.href = binding.feAdminUrl;
    openBtn.target = "_blank";
    openBtn.rel = "noopener noreferrer";
    openBtn.textContent = "\u6253\u5F00 VitalSpan \u7BA1\u7406\u9762\uFF085173\uFF09";
    card.appendChild(openBtn);
    const checkBtn = document.createElement("button");
    checkBtn.className = "btn";
    checkBtn.style.marginLeft = "8px";
    checkBtn.textContent = "\u68C0\u6D4B API \u8FDE\u63A5";
    checkBtn.onclick = async () => {
      checkBtn.disabled = true;
      healthLine.textContent = "\u8FDE\u63A5\u68C0\u6D4B\uFF1A\u68C0\u67E5\u4E2D\u2026";
      healthLine.className = "muted";
      try {
        const res = await pluginExec(EXEC_TOOL_HEALTH, {
          apiBaseUrl: binding.apiBaseUrl
        });
        if (res.ok) {
          healthLine.textContent = `\u8FDE\u63A5\u68C0\u6D4B\uFF1A\u6B63\u5E38\uFF08${res.healthUrl ?? "ok"}\uFF09`;
          healthLine.className = "ok";
        } else {
          healthLine.textContent = `\u8FDE\u63A5\u68C0\u6D4B\uFF1A\u5931\u8D25 \u2014 ${res.error ?? "unknown"}`;
          healthLine.className = "err";
        }
      } catch (e) {
        healthLine.textContent = `\u8FDE\u63A5\u68C0\u6D4B\uFF1A\u5931\u8D25 \u2014 ${e instanceof Error ? e.message : String(e)}`;
        healthLine.className = "err";
      } finally {
        checkBtn.disabled = false;
      }
    };
    card.appendChild(checkBtn);
    const navRow = document.createElement("div");
    navRow.style.cssText = "margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;";
    const resourcesBtn = document.createElement("button");
    resourcesBtn.className = "btn";
    resourcesBtn.textContent = "\u6253\u5F00\u8D44\u6E90\u76EE\u5F55\uFF08\u9875\u5185\uFF09";
    resourcesBtn.onclick = () => navigateWorkspace({ viewId: VIEW_RESOURCES });
    navRow.appendChild(resourcesBtn);
    card.appendChild(navRow);
    const base = adminBase(binding.feAdminUrl);
    const links = document.createElement("div");
    links.style.cssText = "margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;";
    links.appendChild(deepLink(`${base}/viz-components`, "5173 \u7EC4\u4EF6\u5E93\uFF08wf2\uFF09"));
    links.appendChild(deepLink(`${base}/dashboards`, "5173 \u4EEA\u8868\u677F\uFF08wf3\uFF09"));
    links.appendChild(deepLink(`${base}/data-screens`, "5173 \u6570\u636E\u5927\u5C4F\uFF08wf3\uFF09"));
    card.appendChild(links);
    root.appendChild(card);
    root.appendChild(
      el(
        "p",
        "5173\uFF1A\u5206\u6790\u2192\u7EC4\u4EF6\u5E93\u9A8C\u6536 artifactId\uFF1B\u4EEA\u8868\u677F/\u5927\u5C4F\u9A8C\u6536 dashboardId\u3002API \u68C0\u6D4B\u4EC5\u5728 DeepTalk \u672C\u9875\u3002",
        "muted"
      )
    );
  }
  function deepLink(href, label) {
    const a = document.createElement("a");
    a.className = "btn";
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = label;
    return a;
  }
  function boot() {
    const root = document.createElement("div");
    root.id = "vs-root";
    document.body.replaceChildren(root);
    render();
    subscribePluginViewData(render);
  }
  boot();
})();
