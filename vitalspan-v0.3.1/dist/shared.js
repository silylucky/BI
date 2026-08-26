"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pluginRootDir = pluginRootDir;
exports.loadConfig = loadConfig;
exports.requestJson = requestJson;
exports.login = login;
exports.healthCheck = healthCheck;
exports.resolveBundlePath = resolveBundlePath;
exports.copyFromOutput = copyFromOutput;
exports.readBundle = readBundle;
exports.tryPythonPublish = tryPythonPublish;
exports.parseInput = parseInput;
exports.relWorkspacePath = relWorkspacePath;
exports.loadEditorSaveBody = loadEditorSaveBody;
const fs_1 = require("fs");
const editorSaveExport_1 = require("./editorSaveExport");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const plugin_sdk_1 = require("@deeptalk/plugin-sdk");
const readWorkspaceMeta_1 = require("./readWorkspaceMeta");
function pluginRootDir() {
    return path_1.default.join(__dirname, "..");
}
function loadConfig(ctx) {
    let defaults = {};
    const pluginDefaultsPath = path_1.default.join(pluginRootDir(), "assets", "defaults.json");
    if ((0, fs_1.existsSync)(pluginDefaultsPath)) {
        defaults = JSON.parse((0, fs_1.readFileSync)(pluginDefaultsPath, "utf-8"));
    }
    let wsVs = {};
    for (const name of ["local.config.json", "config.json"]) {
        const cfgPath = path_1.default.join(ctx.workspaceRoot, name);
        if ((0, fs_1.existsSync)(cfgPath)) {
            const ws = JSON.parse((0, fs_1.readFileSync)(cfgPath, "utf-8"));
            wsVs = (ws.vitalspan ?? ws);
            break;
        }
    }
    const fromInstance = (0, readWorkspaceMeta_1.readBindingEndpointsFromFile)(ctx.workspaceRoot);
    const merged = { ...defaults, ...wsVs };
    const envApi = process.env.VITALSPAN_API?.replace(/\/$/, "");
    const envFe = process.env.VITALSPAN_FE;
    return {
        apiBase: (envApi ??
            fromInstance.apiBaseUrl ??
            merged.api_base ??
            "http://127.0.0.1:8000/api/v1").replace(/\/$/, ""),
        feBase: envFe ?? fromInstance.feAdminUrl ?? merged.fe_base ?? "http://127.0.0.1:5173/admin",
        username: process.env.VITALSPAN_USERNAME ?? merged.username ?? "admin",
        password: process.env.VITALSPAN_DEV_ADMIN_PASSWORD ?? merged.password_default ?? "changeme",
        vitalspanRoot: process.env.VITALSPAN_ROOT ?? merged.vitalspan_root,
    };
}
const DEFAULT_REQUEST_TIMEOUT_MS = 60000;
async function requestJson(method, url, body, token, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
    const headers = { Accept: "application/json" };
    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
    }
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
        });
        const text = await res.text();
        if (!res.ok) {
            throw new Error(`${method} ${url} -> ${res.status}\n${text}`);
        }
        if (res.status === 204 || !text) {
            return {};
        }
        return JSON.parse(text);
    }
    catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            throw new Error(`${method} ${url} timed out after ${timeoutMs}ms`);
        }
        throw e;
    }
    finally {
        clearTimeout(timer);
    }
}
async function login(cfg) {
    const data = await requestJson("POST", `${cfg.apiBase}/auth/login`, { username: cfg.username, password: cfg.password });
    const token = data.accessToken ?? data.access_token;
    if (!token) {
        throw new Error("login missing accessToken; is VitalSpan API running?");
    }
    return token;
}
async function healthCheck(cfg) {
    const base = cfg.apiBase.replace(/\/api\/v1$/, "");
    const data = await requestJson("GET", `${base}/health`, undefined);
    if (data.status !== "ok") {
        throw new Error(`health check failed: ${JSON.stringify(data)}`);
    }
    return `${base}/health`;
}
function resolveBundlePath(ctx, fileArg) {
    const resolved = (0, plugin_sdk_1.resolvePath)(ctx.workspaceRoot, fileArg);
    if (!resolved.withinWorkspace) {
        throw new Error(`path must be inside workspace: ${fileArg}`);
    }
    const rel = path_1.default.relative(ctx.workspaceRoot, resolved.absolute).replace(/\\/g, "/");
    const parts = rel.split("/");
    if (parts[0] === "output" || parts[0] === "dist") {
        throw new Error(`refusing publish from ${parts[0]}/; write to examples/ or use publish param from with output path`);
    }
    return resolved.absolute;
}
function copyFromOutput(ctx, fromArg) {
    const resolved = (0, plugin_sdk_1.resolvePath)(ctx.workspaceRoot, fromArg);
    if (!resolved.withinWorkspace) {
        throw new Error(`path must be inside workspace: ${fromArg}`);
    }
    const examplesDir = path_1.default.join(ctx.workspaceRoot, "examples");
    (0, fs_1.mkdirSync)(examplesDir, { recursive: true });
    const dest = path_1.default.join(examplesDir, path_1.default.basename(resolved.absolute));
    (0, fs_1.copyFileSync)(resolved.absolute, dest);
    return dest;
}
function readBundle(filePath) {
    const raw = (0, fs_1.readFileSync)(filePath, "utf-8");
    const bundle = JSON.parse(raw);
    if (!bundle.manifest || typeof bundle.files !== "object") {
        throw new Error("bundle must have manifest and files");
    }
    const files = bundle.files;
    const manifest = bundle.manifest;
    const entry = manifest.entry || "index.html";
    const html = files[entry];
    if (typeof html !== "string") {
        throw new Error(`files.${entry} must be a string`);
    }
    const runtime = manifest.runtime;
    if (runtime === "d3" && !html.includes("vsCv.mount(")) {
        throw new Error("d3 bundle must include host.vsCv.mount(");
    }
    if (!html.includes("p.style") && !html.includes("(p && p.style)")) {
        console.warn("warn: bundle may not read p.style; style panel may not work");
    }
    return bundle;
}
function tryPythonPublish(ctx, cfg, fileArg, artifactId, options) {
    let bundlePath = fileArg;
    if (!path_1.default.isAbsolute(fileArg)) {
        try {
            bundlePath = resolveBundlePath(ctx, fileArg);
        }
        catch {
            bundlePath = path_1.default.resolve(ctx.workspaceRoot, fileArg);
        }
    }
    else {
        bundlePath = path_1.default.resolve(fileArg);
    }
    if (!(0, fs_1.existsSync)(bundlePath)) {
        return null;
    }
    const fileForPy = bundlePath.replace(/\\/g, "/");
    const cliCandidates = [
        path_1.default.join(ctx.workspaceRoot, "deeptalk-product", "executor", "cli.py"),
        path_1.default.join(ctx.workspaceRoot, "tools", "..", "deeptalk-product", "executor", "cli.py"),
    ];
    if (cfg.vitalspanRoot) {
        cliCandidates.push(path_1.default.join(cfg.vitalspanRoot, "docs/api/vs-ai-spec/deeptalk-product/executor/cli.py"));
    }
    let cliPath;
    for (const c of cliCandidates) {
        if ((0, fs_1.existsSync)(c)) {
            cliPath = c;
            break;
        }
    }
    const publishScriptCandidates = [];
    if (cfg.vitalspanRoot) {
        publishScriptCandidates.push(path_1.default.join(cfg.vitalspanRoot, "docs/api/vs-ai-spec/tools/publish-ai-viz-artifact.py"));
    }
    publishScriptCandidates.push(path_1.default.join(ctx.workspaceRoot, "tools", "publish-ai-viz-artifact.py"));
    const env = { ...process.env, VITALSPAN_API: cfg.apiBase };
    if (cfg.vitalspanRoot) {
        env.VITALSPAN_ROOT = cfg.vitalspanRoot;
    }
    env.VITALSPAN_USERNAME = cfg.username;
    env.VITALSPAN_DEV_ADMIN_PASSWORD = cfg.password;
    env.VITALSPAN_WORKSPACE = ctx.workspaceRoot;
    if (cliPath) {
        const args = [cliPath, "vitalspan_publish_artifact", "--file", fileForPy];
        if (artifactId)
            args.push("--artifact-id", artifactId);
        if (options?.validateOnly)
            args.push("--validate-only");
        const proc = (0, child_process_1.spawnSync)("python", args, {
            cwd: ctx.workspaceRoot,
            env,
            encoding: "utf-8",
        });
        const out = `${proc.stdout ?? ""}${proc.stderr ?? ""}`;
        if (proc.status !== 0) {
            throw new Error(out || "python publish failed");
        }
        return out;
    }
    for (const script of publishScriptCandidates) {
        if (!(0, fs_1.existsSync)(script))
            continue;
        const args = [script, "--file", fileForPy];
        if (artifactId)
            args.push("--artifact-id", artifactId);
        if (options?.validateOnly)
            args.push("--validate-only");
        const proc = (0, child_process_1.spawnSync)("python", args, {
            cwd: ctx.workspaceRoot,
            env,
            encoding: "utf-8",
        });
        const out = `${proc.stdout ?? ""}${proc.stderr ?? ""}`;
        if (proc.status !== 0) {
            throw new Error(out || "python publish failed");
        }
        return out;
    }
    return null;
}
function parseInput(callInput) {
    return (0, plugin_sdk_1.parseToolInput)(callInput);
}
function relWorkspacePath(ctx, absPath) {
    return path_1.default.relative(ctx.workspaceRoot, absPath).replace(/\\/g, "/");
}
function loadEditorSaveBody(filePath) {
    const doc = JSON.parse((0, fs_1.readFileSync)(filePath, "utf-8"));
    if (doc.layoutJson) {
        const body = { layoutJson: doc.layoutJson };
        if (doc.name)
            body.name = doc.name;
        if ((0, editorSaveExport_1.isEditorSaveLinkageFilters)(doc.globalFilters)) {
            body.globalFilters = doc.globalFilters;
        }
        return body;
    }
    if (doc.version === 2 && doc.widgets) {
        return { layoutJson: doc };
    }
    throw new Error("expected {layoutJson: ...} or layout v2 root");
}
