"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/validateGate.ts
var validateGate_exports = {};
__export(validateGate_exports, {
  VALIDATE_STAMP_OK: () => VALIDATE_STAMP_OK,
  checkValidateGate: () => checkValidateGate,
  computeBundleFingerprint: () => computeBundleFingerprint,
  recordValidateStamp: () => recordValidateStamp
});
module.exports = __toCommonJS(validateGate_exports);
var import_crypto = require("crypto");
var import_fs = require("fs");
var import_path = __toESM(require("path"));
function normalizeRel(relPath) {
  return relPath.replace(/\\/g, "/");
}
function cacheFile(ctx) {
  return import_path.default.join(ctx.workspaceRoot, ".vitalspan", "validate-stamps.json");
}
function loadCache(ctx) {
  const file = cacheFile(ctx);
  if (!(0, import_fs.existsSync)(file)) return {};
  try {
    return JSON.parse((0, import_fs.readFileSync)(file, "utf-8"));
  } catch {
    return {};
  }
}
function saveCache(ctx, cache) {
  const file = cacheFile(ctx);
  (0, import_fs.mkdirSync)(import_path.default.dirname(file), { recursive: true });
  (0, import_fs.writeFileSync)(file, JSON.stringify(cache, null, 2), "utf-8");
}
function computeBundleFingerprint(bundle) {
  const manifest = bundle.manifest ?? {};
  const filesRaw = bundle.files;
  const sortedFiles = {};
  if (filesRaw && typeof filesRaw === "object") {
    const keys = Object.keys(filesRaw).sort();
    for (const key of keys) {
      const val = filesRaw[key];
      if (typeof val === "string") sortedFiles[key] = val;
    }
  }
  const payload = JSON.stringify({ manifest, files: sortedFiles });
  return (0, import_crypto.createHash)("sha256").update(payload, "utf8").digest("hex").slice(0, 16);
}
function recordValidateStamp(ctx, relPath, fingerprint, mode) {
  const rel = normalizeRel(relPath);
  const cache = loadCache(ctx);
  cache[rel] = {
    fingerprint,
    validatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    mode
  };
  saveCache(ctx, cache);
}
function checkValidateGate(ctx, relPath, fingerprint) {
  const rel = normalizeRel(relPath);
  const entry = loadCache(ctx)[rel];
  if (!entry) {
    return {
      ok: false,
      lines: [
        "publish blocked: no validate stamp for this bundle",
        `  \u2192 \u5148\u8FD0\u884C: vitalspan_validate_artifact file=${rel}`,
        "  \u2192 publish \u786C\u95E8\u7981\uFF1A\u7981\u6B62\u8DF3\u8FC7 validate \u76F2\u8BD5 POST"
      ]
    };
  }
  if (entry.fingerprint !== fingerprint) {
    return {
      ok: false,
      lines: [
        "publish blocked: bundle changed since last validate",
        `  \u2192 \u4E0A\u6B21 validate: ${entry.validatedAt} (${entry.mode})`,
        `  \u2192 \u91CD\u65B0\u8FD0\u884C: vitalspan_validate_artifact file=${rel}`
      ]
    };
  }
  return { ok: true };
}
var VALIDATE_STAMP_OK = "validate stamp ok";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  VALIDATE_STAMP_OK,
  checkValidateGate,
  computeBundleFingerprint,
  recordValidateStamp
});
