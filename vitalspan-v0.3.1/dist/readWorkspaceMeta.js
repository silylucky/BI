"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readBindingEndpointsFromFile = readBindingEndpointsFromFile;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const instanceConfig_1 = require("./instanceConfig");
/** Agent 工具进程：从磁盘 workspace meta 读取 binding 端点（无凭据） */
function readBindingEndpointsFromFile(workspaceRoot) {
    const candidates = [".deeptalk/workspace.json", "workspace.json"];
    for (const rel of candidates) {
        const p = path_1.default.join(workspaceRoot, rel);
        if (!(0, fs_1.existsSync)(p))
            continue;
        try {
            const doc = JSON.parse((0, fs_1.readFileSync)(p, "utf-8"));
            const ic = doc.instanceConfig ?? doc;
            const parsed = (0, instanceConfig_1.readDomainBinding)(typeof ic === "object" && ic !== null && !Array.isArray(ic)
                ? ic
                : undefined);
            if (parsed.ok) {
                return {
                    apiBaseUrl: parsed.binding.apiBaseUrl,
                    feAdminUrl: parsed.binding.feAdminUrl,
                };
            }
        }
        catch {
            /* try next */
        }
    }
    return {};
}
