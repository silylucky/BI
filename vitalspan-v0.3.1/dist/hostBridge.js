"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readPluginViewData = readPluginViewData;
exports.subscribePluginViewData = subscribePluginViewData;
exports.navigateWorkspace = navigateWorkspace;
exports.completeWorkspaceSetup = completeWorkspaceSetup;
exports.pluginExec = pluginExec;
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
function completeWorkspaceSetup(instanceConfig) {
    window.__pluginViewAction?.("workspaceSetup.complete", { instanceConfig });
}
async function pluginExec(toolName, params) {
    if (!window.pluginExec) {
        throw new Error("pluginExec unavailable — install execTools and restart DeepTalk");
    }
    return (await window.pluginExec(toolName, params));
}
