"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const instanceConfig_1 = require("../instanceConfig");
const ids_1 = require("../ids");
const hostBridge_1 = require("../hostBridge");
function adminBase(feAdminUrl) {
    return feAdminUrl.trim().replace(/\/+$/, "");
}
function el(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className)
        node.className = className;
    return node;
}
function render() {
    const root = document.getElementById("vs-root");
    if (!root)
        return;
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
    const data = (0, hostBridge_1.readPluginViewData)();
    const parsed = (0, instanceConfig_1.readDomainBinding)(data.instanceConfig);
    if (!parsed.ok) {
        root.appendChild(el("div", parsed.reason, "banner"));
        root.appendChild(el("p", "请在新建工作区向导中填写 VitalSpan API 与前端地址，或联系管理员。", "muted"));
        return;
    }
    const { binding } = parsed;
    const card = document.createElement("div");
    card.className = "card";
    card.appendChild(el("h2", "VitalSpan BI 工作区"));
    card.appendChild(el("p", `模式：${binding.mode === "demo" ? "演示" : "生产"}`));
    card.appendChild(el("p", `API：${binding.apiBaseUrl}`));
    card.appendChild(el("p", `管理面：${binding.feAdminUrl}`));
    const healthLine = el("p", "连接检测：尚未检查", "muted");
    healthLine.id = "vs-health-line";
    card.appendChild(healthLine);
    const openBtn = document.createElement("a");
    openBtn.className = "btn";
    openBtn.href = binding.feAdminUrl;
    openBtn.target = "_blank";
    openBtn.rel = "noopener noreferrer";
    openBtn.textContent = "打开 VitalSpan 管理面（5173）";
    card.appendChild(openBtn);
    const checkBtn = document.createElement("button");
    checkBtn.className = "btn";
    checkBtn.style.marginLeft = "8px";
    checkBtn.textContent = "检测 API 连接";
    checkBtn.onclick = async () => {
        checkBtn.disabled = true;
        healthLine.textContent = "连接检测：检查中…";
        healthLine.className = "muted";
        try {
            const res = await (0, hostBridge_1.pluginExec)(ids_1.EXEC_TOOL_HEALTH, {
                apiBaseUrl: binding.apiBaseUrl,
            });
            if (res.ok) {
                healthLine.textContent = `连接检测：正常（${res.healthUrl ?? "ok"}）`;
                healthLine.className = "ok";
            }
            else {
                healthLine.textContent = `连接检测：失败 — ${res.error ?? "unknown"}`;
                healthLine.className = "err";
            }
        }
        catch (e) {
            healthLine.textContent = `连接检测：失败 — ${e instanceof Error ? e.message : String(e)}`;
            healthLine.className = "err";
        }
        finally {
            checkBtn.disabled = false;
        }
    };
    card.appendChild(checkBtn);
    const navRow = document.createElement("div");
    navRow.style.cssText = "margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;";
    const resourcesBtn = document.createElement("button");
    resourcesBtn.className = "btn";
    resourcesBtn.textContent = "打开资源目录（页内）";
    resourcesBtn.onclick = () => (0, hostBridge_1.navigateWorkspace)({ viewId: ids_1.VIEW_RESOURCES });
    navRow.appendChild(resourcesBtn);
    card.appendChild(navRow);
    const base = adminBase(binding.feAdminUrl);
    const links = document.createElement("div");
    links.style.cssText = "margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;";
    links.appendChild(deepLink(`${base}/viz-components`, "5173 组件库（wf2）"));
    links.appendChild(deepLink(`${base}/dashboards`, "5173 仪表板（wf3）"));
    links.appendChild(deepLink(`${base}/data-screens`, "5173 数据大屏（wf3）"));
    card.appendChild(links);
    root.appendChild(card);
    root.appendChild(el("p", "5173：分析→组件库验收 artifactId；仪表板/大屏验收 dashboardId。API 检测仅在 DeepTalk 本页。", "muted"));
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
    (0, hostBridge_1.subscribePluginViewData)(render);
}
boot();
