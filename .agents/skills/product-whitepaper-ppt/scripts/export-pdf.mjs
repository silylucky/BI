#!/usr/bin/env node
/**
 * Export whitepaper deck to PDF (built-in, no dashiai-ppt).
 *
 * Uses system Chrome/Edge headless + print CSS (one slide = one PDF page).
 * Waits for Mermaid when network is available.
 *
 * Usage:
 *   node export-pdf.mjs --repo /path/to/repo --slug product-whitepaper
 *   node export-pdf.mjs --html /path/to/deck/index.html --out /path/to/export/deck.pdf
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveChromeExecutablePath } from "./resolve-chrome.mjs";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function die(msg) {
  console.error(`[export-pdf] ${msg}`);
  process.exit(1);
}

function mime(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

/** Serve deck dir so Mermaid CDN + relative assets work. */
function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath === "/" ? "/index.html" : urlPath;
      const filePath = path.join(rootDir, rel);
      if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": mime(filePath) });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/index.html?print=1` });
    });
    server.on("error", reject);
  });
}

function runChromePrint({ chrome, url, outPdf, waitMs }) {
  return new Promise((resolve, reject) => {
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--allow-file-access-from-files",
      "--hide-scrollbars",
      `--virtual-time-budget=${waitMs}`,
      "--no-pdf-header-footer",
      `--print-to-pdf=${outPdf}`,
      url,
    ];
    const child = spawn(chrome, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0 || !fs.existsSync(outPdf)) {
        reject(
          new Error(
            `Chrome print failed (code=${code}). ${stderr.slice(0, 800) || "no stderr"}`
          )
        );
        return;
      }
      resolve(outPdf);
    });
  });
}

async function tryPlaywrightPdf({ url, outPdf, chrome }) {
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    try {
      ({ chromium } = await import("playwright"));
    } catch {
      return null;
    }
  }

  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
    // Wait for mermaid svg if present
    await page
      .waitForFunction(
        () => {
          const nodes = document.querySelectorAll(".mermaid");
          if (!nodes.length) return true;
          return [...nodes].every(
            (n) => n.querySelector("svg") || n.dataset.processed === "true"
          );
        },
        { timeout: 60000 }
      )
      .catch(() => {});
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: outPdf,
      width: "1280px",
      height: "720px",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
    });
    return outPdf;
  } finally {
    await browser.close();
  }
}

async function main() {
  const repo = arg("repo", "");
  const slug = arg("slug", "product-whitepaper");
  let htmlPath = arg("html", "");
  let outPdf = arg("out", "");

  if (!htmlPath) {
    if (!repo) die("需要 --repo 或 --html");
    htmlPath = path.join(
      path.resolve(repo),
      "docs",
      "material",
      slug,
      "deck",
      "index.html"
    );
  }
  htmlPath = path.resolve(htmlPath);
  if (!fs.existsSync(htmlPath)) die(`找不到 HTML: ${htmlPath}`);

  if (!outPdf) {
    const materialDir = path.dirname(path.dirname(htmlPath));
    outPdf = path.join(materialDir, "export", `${slug}.pdf`);
  }
  outPdf = path.resolve(outPdf);
  fs.mkdirSync(path.dirname(outPdf), { recursive: true });
  if (fs.existsSync(outPdf)) fs.unlinkSync(outPdf);

  const chrome = resolveChromeExecutablePath();
  if (!chrome) {
    die(
      "未找到 Chrome / Chromium / Edge。请安装其一，或设置环境变量 CHROME_PATH。PDF 导出不需要 dashiai-ppt。"
    );
  }

  const deckDir = path.dirname(htmlPath);
  const { server, url } = await startStaticServer(deckDir);
  const waitMs = Number(arg("wait-ms", "12000"));

  try {
    let used = "chrome-cli";
    const viaPw = await tryPlaywrightPdf({ url, outPdf, chrome });
    if (viaPw) {
      used = "playwright";
    } else {
      await runChromePrint({ chrome, url, outPdf, waitMs });
    }

    const stat = fs.statSync(outPdf);
    console.log(
      JSON.stringify(
        {
          ok: true,
          out: outPdf,
          bytes: stat.size,
          engine: used,
          chrome,
          url,
        },
        null,
        2
      )
    );
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(`[export-pdf] ${err.message || err}`);
  process.exit(1);
});
