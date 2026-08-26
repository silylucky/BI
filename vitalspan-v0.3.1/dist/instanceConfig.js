"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readDomainBinding = readDomainBinding;
exports.buildDefaultInstanceConfig = buildDefaultInstanceConfig;
const ids_1 = require("./ids");
function isRecord(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
function normalizeUrl(url, trailingSlash) {
    const trimmed = url.trim().replace(/\/+$/, "");
    return trailingSlash ? `${trimmed}/` : trimmed;
}
function parseBinding(raw) {
    if (!isRecord(raw))
        return null;
    const mode = raw.mode;
    const apiBaseUrl = raw.apiBaseUrl ?? raw.api_base;
    const feAdminUrl = raw.feAdminUrl ?? raw.fe_base;
    if (mode !== "demo" && mode !== "live")
        return null;
    if (typeof apiBaseUrl !== "string" || !apiBaseUrl.startsWith("http"))
        return null;
    if (typeof feAdminUrl !== "string" || !feAdminUrl.startsWith("http"))
        return null;
    return {
        mode,
        apiBaseUrl: normalizeUrl(apiBaseUrl, false),
        feAdminUrl: normalizeUrl(feAdminUrl, false),
    };
}
function readDomainBinding(instanceConfig) {
    if (!isRecord(instanceConfig)) {
        return { ok: false, reason: "未绑定 VitalSpan：请先完成工作区创建向导" };
    }
    const pluginRaw = instanceConfig.plugin;
    if (!isRecord(pluginRaw)) {
        return { ok: false, reason: "instanceConfig.plugin 缺失" };
    }
    if (pluginRaw.id !== ids_1.PLUGIN_ID) {
        return { ok: false, reason: `plugin.id 应为 ${ids_1.PLUGIN_ID}，当前为 ${String(pluginRaw.id)}` };
    }
    const binding = parseBinding(instanceConfig[ids_1.DOMAIN_KEY]);
    if (!binding) {
        return {
            ok: false,
            reason: `instanceConfig.${ids_1.DOMAIN_KEY} 无效：需要 mode(demo|live)、apiBaseUrl、feAdminUrl`,
        };
    }
    return {
        ok: true,
        plugin: {
            id: ids_1.PLUGIN_ID,
            version: typeof pluginRaw.version === "string" ? pluginRaw.version : ids_1.PLUGIN_VERSION,
            templateId: typeof pluginRaw.templateId === "string" ? pluginRaw.templateId : ids_1.TEMPLATE_ID,
            templateVersion: typeof pluginRaw.templateVersion === "string"
                ? pluginRaw.templateVersion
                : ids_1.TEMPLATE_VERSION,
        },
        binding,
    };
}
function buildDefaultInstanceConfig(binding) {
    return {
        plugin: {
            id: ids_1.PLUGIN_ID,
            version: ids_1.PLUGIN_VERSION,
            templateId: ids_1.TEMPLATE_ID,
            templateVersion: ids_1.TEMPLATE_VERSION,
        },
        [ids_1.DOMAIN_KEY]: binding,
    };
}
