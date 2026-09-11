/**
 * One-off browser-reviewer walkthrough for report center (local real APIs).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, ".dev", "walkthrough", "2026-08-09");
const CAND = path.join(ROOT, ".dev", "baselines", "_candidates");
const API = "http://127.0.0.1:8000";
const BASE = "http://127.0.0.1:5173";

function readPassword() {
  const envPath = path.join(ROOT, "backend", ".env");
  if (!fs.existsSync(envPath)) return process.env.VITALSPAN_DEV_ADMIN_PASSWORD ?? "changeme";
  const line = fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("VITALSPAN_DEV_ADMIN_PASSWORD="));
  return line ? line.split("=").slice(1).join("=").trim() : "changeme";
}

async function apiLogin(request, password) {
  const res = await request.post(`${API}/api/v1/auth/login`, {
    data: { username: "admin", password },
  });
  if (!res.ok()) throw new Error(`login failed: ${res.status()}`);
  const body = await res.json();
  return body.accessToken;
}

async function shot(page, name, results, step) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const cand = path.join(CAND, `report-center-${name}.png`);
  fs.copyFileSync(file, cand);
  results.screenshots.push({ step, file: `.dev/walkthrough/2026-08-09/${name}.png` });
}

async function waitStable(page) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function runStep(page, results, id, label, fn) {
  const row = { id, label, status: "pass" };
  results.steps.push(row);
  try {
    await fn();
    row.status = "pass";
  } catch (err) {
    row.status = "fail";
    row.error = String(err?.message ?? err);
    results.findings.push({
      id: `F-${id}`,
      severity: "P0",
      step: id,
      route: page.url(),
      repro: `${label}: ${row.error}`,
    });
    await shot(page, `${id}-FAIL`, results, id).catch(() => {});
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(CAND, { recursive: true });
  const password = readPassword();
  const results = {
    steps: [],
    screenshots: [],
    consoleErrors: [],
    networkFailures: [],
    findings: [],
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      results.consoleErrors.push({ text: msg.text(), url: page.url() });
    }
  });
  page.on("response", (res) => {
    const url = res.url();
    if (!url.includes("/api/")) return;
    const status = res.status();
    if (status >= 400 && status !== 401 && status !== 403) {
      results.networkFailures.push({ status, url, page: page.url() });
    }
  });

  const token = await apiLogin(context.request, password);
  await page.addInitScript((t) => {
    localStorage.setItem("vitalspan:access_token", t);
  }, token);

  await runStep(page, results, "R0", "health + login", async () => {
    const health = await context.request.get(`${API}/health`);
    if (!health.ok()) throw new Error(`health ${health.status()}`);
  });

  await runStep(page, results, "R1", "report center hub", async () => {
    await page.goto(`${BASE}/admin/reports/center`);
    await waitStable(page);
    if (!(await page.getByRole("heading", { name: /报表中心/i }).isVisible())) {
      throw new Error("missing hub heading");
    }
    await shot(page, "R1-hub", results, "R1");
  });

  await runStep(page, results, "R2", "sidebar single entry", async () => {
    const reportLinks = page.getByRole("link", { name: "报表中心" });
    if ((await reportLinks.count()) < 1) throw new Error("no 报表中心 nav link");
    await shot(page, "R2-sidebar", results, "R2");
  });

  await runStep(page, results, "R3", "expand document templates", async () => {
    await page.goto(`${BASE}/admin/reports/center`);
    await waitStable(page);
    const btn = page.getByRole("button", { name: /文档模板/i });
    if (await btn.isVisible()) await btn.click();
    await waitStable(page);
    await shot(page, "R3-doc-templates", results, "R3");
  });

  await runStep(page, results, "R4", "standard analysis page", async () => {
    await page.goto(`${BASE}/admin/reports/standard`);
    await waitStable(page);
    await shot(page, "R4-standard", results, "R4");
  });

  await runStep(page, results, "R5", "report templates page", async () => {
    await page.goto(`${BASE}/admin/reports/templates`);
    await waitStable(page);
    const hint = page.getByText(/可视化模板/);
    if (!(await hint.isVisible({ timeout: 8000 }).catch(() => false))) {
      throw new Error("missing viz vs doc template hint");
    }
    await shot(page, "R5-templates", results, "R5");
  });

  await runStep(page, results, "R6", "schedules page", async () => {
    await page.goto(`${BASE}/admin/reports/schedules`);
    await waitStable(page);
    await shot(page, "R6-schedules", results, "R6");
  });

  await runStep(page, results, "R7", "open first template view", async () => {
    const nodesRes = await context.request.get(`${API}/api/v1/reports/catalog/nodes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!nodesRes.ok()) throw new Error(`catalog nodes ${nodesRes.status()}`);
    const nodes = await nodesRes.json();
    const tpl = Array.isArray(nodes) ? nodes.find((n) => n.nodeType === "template") : null;
    if (!tpl?.id) {
      const row = results.steps.find((s) => s.id === "R7");
      row.status = "skip";
      row.note = "no template node in catalog";
      return;
    }
    await page.goto(`${BASE}/admin/reports/view/${tpl.id}`);
    await waitStable(page);
    await page.getByRole("heading").first().waitFor({ timeout: 15000 });
    await shot(page, "R7-template-view", results, "R7");
  });

  await runStep(page, results, "R8", "recent access link from hub", async () => {
    await page.goto(`${BASE}/admin/reports/center`);
    await waitStable(page);
    const recent = page.getByText("最近访问").locator("..").getByRole("link").first();
    if (await recent.isVisible({ timeout: 5000 }).catch(() => false)) {
      await recent.click();
      await waitStable(page);
      await shot(page, "R8-recent-link", results, "R8");
    } else {
      const row = results.steps.find((s) => s.id === "R8");
      row.status = "skip";
      row.note = "no recent items";
    }
  });

  await browser.close();

  const summaryPath = path.join(OUT, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  const passed = results.steps.filter((s) => s.status === "pass").length;
  const failed = results.steps.filter((s) => s.status === "fail").length;
  const skipped = results.steps.filter((s) => s.status === "skip").length;
  console.log(
    JSON.stringify({
      passed,
      failed,
      skipped,
      consoleErrors: results.consoleErrors.length,
      networkFailures: results.networkFailures.length,
      findings: results.findings.length,
      summaryPath,
    }),
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
