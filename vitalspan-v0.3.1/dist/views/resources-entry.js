"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const instanceConfig_1 = require("../instanceConfig");
const ids_1 = require("../ids");
const hostBridge_1 = require("../hostBridge");
function parseSelectedId(routeSearch) {
    if (!routeSearch)
        return null;
    const q = routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch;
    return new URLSearchParams(q).get("id");
}
function el(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className)
        node.className = className;
    return node;
}
function adminBase(feAdminUrl) {
    return feAdminUrl.trim().replace(/\/+$/, "");
}
async function render() {
    const root = document.getElementById("vs-resources-root");
    if (!root)
        return;
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
    const data = (0, hostBridge_1.readPluginViewData)();
    const selectedId = parseSelectedId(data.routeSearch);
    const parsed = (0, instanceConfig_1.readDomainBinding)(data.instanceConfig);
    const nav = document.createElement("div");
    const homeBtn = document.createElement("button");
    homeBtn.className = "btn secondary";
    homeBtn.textContent = "返回 VitalSpan 首页";
    homeBtn.onclick = () => (0, hostBridge_1.navigateWorkspace)({ viewId: ids_1.VIEW_HOME });
    nav.appendChild(homeBtn);
    root.appendChild(nav);
    if (!parsed.ok) {
        root.appendChild(el("div", parsed.reason, "banner"));
        return;
    }
    const { binding } = parsed;
    root.appendChild(el("h2", "资源目录"));
    root.appendChild(el("p", selectedId ? `深链定位：id=${selectedId}` : "选择组件或仪表板以更新父级 URL", "muted"));
    const status = el("p", "加载中…", "muted");
    root.appendChild(status);
    let snapshot;
    try {
        snapshot = await (0, hostBridge_1.pluginExec)(ids_1.EXEC_TOOL_LOAD_INSTANCE, {
            baseUrl: binding.apiBaseUrl,
            apiBaseUrl: binding.apiBaseUrl,
            feAdminUrl: binding.feAdminUrl,
            instanceId: binding.mode,
        });
    }
    catch (e) {
        status.textContent = `加载失败：${e instanceof Error ? e.message : String(e)}`;
        status.className = "err";
        const retry = document.createElement("button");
        retry.className = "btn";
        retry.textContent = "重试";
        retry.onclick = () => void render();
        root.appendChild(retry);
        return;
    }
    if (!snapshot.ok) {
        status.textContent = `加载失败：${snapshot.error ?? "unknown"}`;
        status.className = "err";
        const retry = document.createElement("button");
        retry.className = "btn";
        retry.textContent = "重试";
        retry.onclick = () => void render();
        root.appendChild(retry);
        return;
    }
    status.textContent = `API ${snapshot.apiBaseUrl} · 组件 ${snapshot.artifacts?.length ?? 0} · 仪表板 ${snapshot.dashboards?.length ?? 0}`;
    const fe = adminBase(binding.feAdminUrl);
    appendSection(root, "组件库（wf2）", snapshot.artifacts ?? [], selectedId, (row) => (0, hostBridge_1.navigateWorkspace)({ viewId: "resources", search: `?id=${encodeURIComponent(row.id)}` }));
    appendSection(root, "仪表板 / 大屏（wf3）", snapshot.dashboards ?? [], selectedId, (row) => (0, hostBridge_1.navigateWorkspace)({ viewId: "resources", search: `?id=${encodeURIComponent(row.id)}` }));
    if (selectedId) {
        const detail = document.createElement("div");
        detail.className = "card";
        detail.appendChild(el("h3", `已选 id=${selectedId}`));
        const artifact = snapshot.artifacts?.find((a) => a.id === selectedId);
        const dashboard = snapshot.dashboards?.find((d) => d.id === selectedId);
        if (artifact) {
            detail.appendChild(el("p", `组件：${artifact.name}`));
            const open = document.createElement("a");
            open.className = "btn";
            open.href = `${fe}/viz-components`;
            open.target = "_blank";
            open.rel = "noopener noreferrer";
            open.textContent = "在 5173 打开组件库";
            detail.appendChild(open);
        }
        else if (dashboard) {
            detail.appendChild(el("p", `仪表板：${dashboard.name}`));
            const path = dashboard.surfaceKind === "data-screen" ? "/data-screens" : "/dashboards";
            const open = document.createElement("a");
            open.className = "btn";
            open.href = `${fe}${path}`;
            open.target = "_blank";
            open.rel = "noopener noreferrer";
            open.textContent = "在 5173 打开编辑面";
            detail.appendChild(open);
        }
        else {
            detail.appendChild(el("p", "未在列表中找到该 id", "err"));
        }
        root.appendChild(detail);
    }
}
function appendSection(root, title, rows, selectedId, onSelect) {
    const card = document.createElement("div");
    card.className = "card";
    card.appendChild(el("h3", title));
    if (!rows.length) {
        card.appendChild(el("p", "（空）", "muted"));
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
    (0, hostBridge_1.subscribePluginViewData)(() => void render());
}
boot();
