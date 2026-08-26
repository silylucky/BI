"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCapabilityManifest = resolveCapabilityManifest;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const shared_1 = require("./shared");
function resolveCapabilityManifest(_ctx, cfg) {
    const bundled = path_1.default.join((0, shared_1.pluginRootDir)(), "assets", "capability-manifest.json");
    const candidates = [bundled];
    if (cfg.vitalspanRoot) {
        candidates.push(path_1.default.join(cfg.vitalspanRoot, "docs/api/vs-ai-spec/capability-manifest.json"));
        candidates.push(path_1.default.join(cfg.vitalspanRoot, "capability-manifest.json"));
    }
    candidates.push(path_1.default.join(_ctx.workspaceRoot, "capability-manifest.json"));
    candidates.push(path_1.default.join(_ctx.workspaceRoot, "docs/api/vs-ai-spec/capability-manifest.json"));
    for (const candidate of candidates) {
        if ((0, fs_1.existsSync)(candidate)) {
            return candidate;
        }
    }
    throw new Error("capability-manifest.json missing from plugin assets; reinstall vitalspan plugin.");
}
