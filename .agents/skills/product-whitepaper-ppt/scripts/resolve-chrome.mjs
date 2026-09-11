#!/usr/bin/env node
/**
 * Resolve Chrome / Chromium / Edge for headless PDF export.
 * Honors CHROME_PATH. No dependency on dashiai-ppt.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function resolveExisting(candidate) {
  if (!candidate) return "";
  const resolved = path.resolve(candidate);
  return existsSync(resolved) ? resolved : "";
}

function which(command) {
  const binary = process.platform === "win32" ? "where" : "which";
  try {
    const output = execFileSync(binary, [command], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return (
      output
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l && existsSync(l)) || ""
    );
  } catch {
    return "";
  }
}

export function resolveChromeExecutablePath() {
  if (process.env.CHROME_PATH) {
    const fromEnv = resolveExisting(process.env.CHROME_PATH);
    if (fromEnv) return fromEnv;
  }

  const mac = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  ];
  for (const c of mac) {
    const hit = resolveExisting(c);
    if (hit) return hit;
  }

  const winProgramFiles = process.env.ProgramFiles || "C:\\Program Files";
  const winProgramFilesX86 =
    process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const localAppData = process.env.LOCALAPPDATA || "";
  const win = [
    path.join(winProgramFiles, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(
      winProgramFilesX86,
      "Google",
      "Chrome",
      "Application",
      "chrome.exe"
    ),
    localAppData &&
      path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(winProgramFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(winProgramFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
  ].filter(Boolean);
  for (const c of win) {
    const hit = resolveExisting(c);
    if (hit) return hit;
  }

  const commands =
    process.platform === "win32"
      ? ["chrome.exe", "chromium.exe", "msedge.exe"]
      : [
          "google-chrome",
          "google-chrome-stable",
          "chromium",
          "chromium-browser",
          "chrome",
          "microsoft-edge",
          "msedge",
        ];
  for (const cmd of commands) {
    const hit = which(cmd);
    if (hit) return hit;
  }

  return "";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const p = resolveChromeExecutablePath();
  if (!p) {
    console.error("Chrome/Chromium/Edge not found. Set CHROME_PATH.");
    process.exit(1);
  }
  console.log(p);
}
