"use strict";
(() => {
  // src/ids.ts
  var PLUGIN_ID = "vitalspan";
  var PLUGIN_VERSION = "0.3.1";
  var TEMPLATE_ID = "vitalspan.bi.default";
  var TEMPLATE_VERSION = "1.0.0";
  var DOMAIN_KEY = "vitalspan";
  var VIEW_HOME = "home";
  var EXEC_TOOL_LOAD_INSTANCE = "loadInstance";

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

  // src/views/resources-entry.ts
  function parseSelectedId(routeSearch) {
    if (!routeSearch) return null;
    const q = routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch;
    return new URLSearchParams(q).get("id");
  }
  function el(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function adminBase(feAdminUrl) {
    return feAdminUrl.trim().replace(/\/+$/, "");
  }
  async function render() {
    const root = document.getElementById("vs-resources-root");
    if (!root) return;
    root.replaceChildren();
    const style = document.createElement("style");
    style.textContent = `
    * { box-sizing: border-box; margin: 0; }
    html, body, #vs-resources-root { height: 100%; }
    body { font-family: system-ui, sans-serif; background: var(--bg-primary, #0f1419); color: var(--fg-primary, #e7ecf1); }
    #vs-resources-root { padding: 24px; overflow: auto; }
    .banner { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; background: #3d1f1f; color: #fecaca; border: 1px solid #7f1d1d; }
    .card { padding: 16px; border-radius: 8px; background: var(--bg-secondary, #1a2332); margin-bottom: 12px; }
    .muted { color: var(--fg-secondary, #94a3b8); font-size: 13px; margin-top: 8px; }
    .btn { display: inline-block; margin-top: 8px; margin-right: 8px; padding: 8px 16px; border-radius: 6px; background: #2563eb; color: #fff; text-decoration: none; cursor: pointer; border: none; font-size: 14px; }
    .btn.secondary { background: #334155; }
    .row { padding: 8px 12px; border-radius: 6px; margin-top: 6px; border: 1px solid #334155; cursor: pointer; }
    .row.selected { border-color: #2563eb; background: #1e3a5f; }
    .err { color: #fca5a5; }
  `;
    root.appendChild(style);
    const data = readPluginViewData();
    const selectedId = parseSelectedId(data.routeSearch);
    const parsed = readDomainBinding(data.instanceConfig);
    const nav = document.createElement("div");
    const homeBtn = document.createElement("button");
    homeBtn.className = "btn secondary";
    homeBtn.textContent = "\u8FD4\u56DE VitalSpan \u9996\u9875";
    homeBtn.onclick = () => navigateWorkspace({ viewId: VIEW_HOME });
    nav.appendChild(homeBtn);
    root.appendChild(nav);
    if (!parsed.ok) {
      root.appendChild(el("div", parsed.reason, "banner"));
      return;
    }
    const { binding } = parsed;
    root.appendChild(el("h2", "\u8D44\u6E90\u76EE\u5F55"));
    root.appendChild(
      el(
        "p",
        selectedId ? `\u6DF1\u94FE\u5B9A\u4F4D\uFF1Aid=${selectedId}` : "\u9009\u62E9\u7EC4\u4EF6\u6216\u4EEA\u8868\u677F\u4EE5\u66F4\u65B0\u7236\u7EA7 URL",
        "muted"
      )
    );
    const status = el("p", "\u52A0\u8F7D\u4E2D\u2026", "muted");
    root.appendChild(status);
    let snapshot;
    try {
      snapshot = await pluginExec(EXEC_TOOL_LOAD_INSTANCE, {
        baseUrl: binding.apiBaseUrl,
        apiBaseUrl: binding.apiBaseUrl,
        feAdminUrl: binding.feAdminUrl,
        instanceId: binding.mode
      });
    } catch (e) {
      status.textContent = `\u52A0\u8F7D\u5931\u8D25\uFF1A${e instanceof Error ? e.message : String(e)}`;
      status.className = "err";
      const retry = document.createElement("button");
      retry.className = "btn";
      retry.textContent = "\u91CD\u8BD5";
      retry.onclick = () => void render();
      root.appendChild(retry);
      return;
    }
    if (!snapshot.ok) {
      status.textContent = `\u52A0\u8F7D\u5931\u8D25\uFF1A${snapshot.error ?? "unknown"}`;
      status.className = "err";
      const retry = document.createElement("button");
      retry.className = "btn";
      retry.textContent = "\u91CD\u8BD5";
      retry.onclick = () => void render();
      root.appendChild(retry);
      return;
    }
    status.textContent = `API ${snapshot.apiBaseUrl} \xB7 \u7EC4\u4EF6 ${snapshot.artifacts?.length ?? 0} \xB7 \u4EEA\u8868\u677F ${snapshot.dashboards?.length ?? 0}`;
    const fe = adminBase(binding.feAdminUrl);
    appendSection(
      root,
      "\u7EC4\u4EF6\u5E93\uFF08wf2\uFF09",
      snapshot.artifacts ?? [],
      selectedId,
      (row) => navigateWorkspace({ viewId: "resources", search: `?id=${encodeURIComponent(row.id)}` })
    );
    appendSection(
      root,
      "\u4EEA\u8868\u677F / \u5927\u5C4F\uFF08wf3\uFF09",
      snapshot.dashboards ?? [],
      selectedId,
      (row) => navigateWorkspace({ viewId: "resources", search: `?id=${encodeURIComponent(row.id)}` })
    );
    if (selectedId) {
      const detail = document.createElement("div");
      detail.className = "card";
      detail.appendChild(el("h3", `\u5DF2\u9009 id=${selectedId}`));
      const artifact = snapshot.artifacts?.find((a) => a.id === selectedId);
      const dashboard = snapshot.dashboards?.find((d) => d.id === selectedId);
      if (artifact) {
        detail.appendChild(el("p", `\u7EC4\u4EF6\uFF1A${artifact.name}`));
        const open = document.createElement("a");
        open.className = "btn";
        open.href = `${fe}/viz-components`;
        open.target = "_blank";
        open.rel = "noopener noreferrer";
        open.textContent = "\u5728 5173 \u6253\u5F00\u7EC4\u4EF6\u5E93";
        detail.appendChild(open);
      } else if (dashboard) {
        detail.appendChild(el("p", `\u4EEA\u8868\u677F\uFF1A${dashboard.name}`));
        const path = dashboard.surfaceKind === "data-screen" ? "/data-screens" : "/dashboards";
        const open = document.createElement("a");
        open.className = "btn";
        open.href = `${fe}${path}`;
        open.target = "_blank";
        open.rel = "noopener noreferrer";
        open.textContent = "\u5728 5173 \u6253\u5F00\u7F16\u8F91\u9762";
        detail.appendChild(open);
      } else {
        detail.appendChild(el("p", "\u672A\u5728\u5217\u8868\u4E2D\u627E\u5230\u8BE5 id", "err"));
      }
      root.appendChild(detail);
    }
  }
  function appendSection(root, title, rows, selectedId, onSelect) {
    const card = document.createElement("div");
    card.className = "card";
    card.appendChild(el("h3", title));
    if (!rows.length) {
      card.appendChild(el("p", "\uFF08\u7A7A\uFF09", "muted"));
      root.appendChild(card);
      return;
    }
    for (const row of rows) {
      const line = document.createElement("div");
      line.className = row.id === selectedId ? "row selected" : "row";
      line.textContent = `${row.id}  ${row.name}`;
      line.onclick = () => onSelect(row);
      card.appendChild(line);
    }
    root.appendChild(card);
  }
  function boot() {
    const root = document.createElement("div");
    root.id = "vs-resources-root";
    document.body.replaceChildren(root);
    void render();
    subscribePluginViewData(() => void render());
  }
  boot();
})();
