/**
 * Step 0 — Chrome CDP Profiler for VitalSpan FE hot paths.
 * Run: node scripts/perf-profile-hotpaths.mjs
 * Requires: fe dev @5173, backend @8000, admin login password in env.
 */
import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FE_BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173";
const API_BASE = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:8000";
const ADMIN_PASSWORD = process.env.VITALSPAN_DEV_ADMIN_PASSWORD ?? "changeme";

const DASHBOARD_MULTI_WIDGET = "435f5dc6-a8ba-4bee-9c32-cd35a444f14e";
const DATA_SCREEN_MAP = "6b3b7c91-ea25-48e3-8544-f7dbbc019f0e";
const MAP_WIDGET_ID = "f6e31dcd-ad59-4c6a-8ba7-55b42177e468";
const DASHBOARD_MAP_WIDGET = "ada591c3-4f81-412d-a29f-566b57a3dd85";

function analyzeProfile(profile) {
  const { nodes = [], samples = [], timeDeltas = [] } = profile;
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const totals = new Map();

  for (let i = 0; i < samples.length; i++) {
    const deltaUs = timeDeltas[i] ?? 0;
    if (deltaUs <= 0) continue;
    let nodeId = samples[i];
    const seen = new Set();
    while (nodeId != null && !seen.has(nodeId)) {
      seen.add(nodeId);
      const node = nodeById.get(nodeId);
      if (!node) break;
      const cf = node.callFrame ?? {};
      const fn = cf.functionName || "(anonymous)";
      const file = (cf.url || "").split("/").pop() || "(native)";
      const key = `${fn} · ${file}`;
      totals.set(key, (totals.get(key) ?? 0) + deltaUs);
      nodeId = node.parent;
    }
  }

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, us]) => ({ name, ms: Math.round(us / 1000) }));
}

async function loginToken(request) {
  const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { username: "admin", password: ADMIN_PASSWORD },
  });
  if (!res.ok()) throw new Error(`login failed: ${res.status()}`);
  const body = await res.json();
  return body.accessToken ?? body.access_token;
}

async function profileAction(page, label, action) {
  const client = await page.context().newCDPSession(page);
  await client.send("Profiler.enable");
  await client.send("Profiler.start");

  const longTasks = [];
  await page.evaluate(() => {
    window.__vsLongTasks = [];
    window.__vsLtObs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__vsLongTasks.push({ name: e.name, duration: e.duration, start: e.startTime });
      }
    });
    window.__vsLtObs.observe({ type: "longtask", buffered: true });
  });

  const t0 = Date.now();
  await action();
  const elapsedMs = Date.now() - t0;

  const { profile } = await client.send("Profiler.stop");
  await client.detach();

  const top = analyzeProfile(profile);
  const longTaskSummary = await page.evaluate(() => {
    const tasks = window.__vsLongTasks ?? [];
    window.__vsLtObs?.disconnect();
    return {
      count: tasks.length,
      totalMs: Math.round(tasks.reduce((s, t) => s + t.duration, 0)),
      top: [...tasks].sort((a, b) => b.duration - a.duration).slice(0, 5),
    };
  });

  return { label, elapsedMs, top, longTaskSummary };
}

async function seedAuth(page, token) {
  await page.addInitScript((t) => {
    localStorage.setItem("vitalspan:access_token", t);
  }, token);
}

async function waitDashboardReady(page) {
  await page.waitForSelector('[data-testid="dashboard-name-field"], button:has-text("保存")', {
    timeout: 30_000,
  });
  await page.waitForTimeout(1500);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const token = await loginToken(context.request);
  await seedAuth(page, token);

  const results = [];

  // P3 — multi-widget edit enter (cold load)
  results.push(
    await profileAction(page, "P3_multi_widget_enter", async () => {
      await page.goto(`${FE_BASE}/admin/dashboards/${DASHBOARD_MULTI_WIDGET}/edit`, {
        waitUntil: "domcontentloaded",
      });
      await waitDashboardReady(page);
      await page.waitForSelector(".embedded-chart-live-surface, [class*='chart']", {
        timeout: 25_000,
      });
      await page.waitForTimeout(2000);
    }),
  );

  // P2 — map widget select + inspector panel (grid dashboard)
  results.push(
    await profileAction(page, "P2_map_inspector_select", async () => {
      await page.goto(`${FE_BASE}/admin/dashboards/${DASHBOARD_MULTI_WIDGET}/edit`);
      await waitDashboardReady(page);
      const mapSurface = page.locator(
        `[data-widget-id="${DASHBOARD_MAP_WIDGET}"], [data-chart-id="${DASHBOARD_MAP_WIDGET}"]`,
      ).first();
      if ((await mapSurface.count()) === 0) {
        await page.locator(".embedded-chart-live-surface").first().click({ timeout: 10_000 });
      } else {
        await mapSurface.click({ timeout: 10_000 });
      }
      await page.waitForTimeout(500);
      const dataTab = page.getByRole("tab", { name: /数据/ });
      if (await dataTab.count()) await dataTab.click();
      await page.waitForTimeout(1500);
    }),
  );

  // P1 — data-screen pixel canvas map widget resize drag
  results.push(
    await profileAction(page, "P1_pixel_canvas_map_resize", async () => {
      await page.goto(`${FE_BASE}/admin/data-screens/${DATA_SCREEN_MAP}/edit`);
      await waitDashboardReady(page);
      const shape = page.locator(`[data-testid="pixel-shape-${MAP_WIDGET_ID}"]`);
      await shape.waitFor({ state: "visible", timeout: 25_000 });
      await shape.click();
      const handle = page.getByTestId("pixel-resize-se");
      await handle.waitFor({ state: "visible", timeout: 10_000 });
      const box = await handle.boundingBox();
      if (!box) throw new Error("resize handle missing");
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) {
        await page.mouse.move(cx + i * 8, cy + i * 6, { steps: 2 });
        await page.waitForTimeout(30);
      }
      await page.mouse.up();
      await page.waitForTimeout(800);
    }),
  );

  await browser.close();

  const outDir = join(__dirname, "../../docs/reviews/grounded");
  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, "2026-08-26-vitalspan-fe-performance-profile.json");
  writeFileSync(jsonPath, JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2));

  console.log(JSON.stringify(results, null, 2));
  console.log(`\nWrote ${jsonPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
