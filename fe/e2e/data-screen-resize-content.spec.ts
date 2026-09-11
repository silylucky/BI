import { expect, test, type Page } from "@playwright/test";

const DS_ID = "00000000-0000-4000-8000-000000000010";
const SCREEN_ID = "ds-resize-e2e";

const TABLE_WIDGET = {
  id: "w-table-1",
  type: "chart",
  title: "销售明细",
  order: 0,
  x: 120,
  y: 80,
  width: 480,
  height: 320,
  chartConfig: {
    chartType: "table-info",
    chartId: "w-table-1",
    mode: "sql",
    dataSourceId: DS_ID,
    sql: "SELECT region, amount FROM sales LIMIT 10",
    dimensions: [{ field: "region" }],
    metrics: [{ field: "amount" }],
  },
};

const BAR_WIDGET = {
  id: "w-bar-1",
  type: "chart",
  title: "区域对比",
  order: 1,
  x: 680,
  y: 120,
  width: 400,
  height: 280,
  chartConfig: {
    chartType: "bar",
    chartId: "w-bar-1",
    mode: "sql",
    dataSourceId: DS_ID,
    sql: "SELECT region, amount FROM sales LIMIT 10",
    dimensions: [{ field: "region" }],
    metrics: [{ field: "amount" }],
  },
};

const DATA_SCREEN_LAYOUT = {
  version: 2,
  canvas: { width: 1920, height: 1080 },
  widgets: [TABLE_WIDGET, BAR_WIDGET],
  globalFilters: [],
  styleConfig: { surfaceKind: "data-screen", colorScheme: "dark" },
};

async function mockDataScreenEditApis(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("vitalspan:access_token", "e2e-token");
  });

  await page.route("**/api/v1/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "u1", username: "admin", roles: ["admin"] }),
    });
  });

  await page.route("**/api/v1/datasources**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [{ id: DS_ID, name: "分析库", code: "analytics" }] }),
    });
  });

  await page.route("**/api/v1/datasets**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.route("**/api/v1/charts/types**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          type: "table-info",
          displayName: "明细表",
          styleVariants: ["default"],
          fieldRule: {},
          renderer: "antv",
        },
        {
          type: "bar",
          displayName: "柱状图",
          styleVariants: ["default"],
          fieldRule: {},
          renderer: "antv",
        },
      ]),
    });
  });

  await page.route(`**/api/v1/dashboards/${SCREEN_ID}/global-filters`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ filters: [], linkageRules: [] }),
    });
  });

  await page.route(`**/api/v1/dashboards/${SCREEN_ID}`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: SCREEN_ID,
          name: "Resize E2E 大屏",
          layoutJson: DATA_SCREEN_LAYOUT,
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route("**/api/v1/query/execute**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        columns: ["region", "amount"],
        rows: [
          ["华东", 120],
          ["华北", 98],
        ],
      }),
    });
  });
}

test("data-screen resize keeps all widgets and content container visible", async ({ page }) => {
  test.setTimeout(60_000);
  await mockDataScreenEditApis(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/admin/data-screens/${SCREEN_ID}/edit`);

  await expect(page.getByTestId("dashboard-name-field")).toContainText("Resize E2E 大屏", {
    timeout: 20_000,
  });

  const content = page.locator('[data-testid="pixel-canvas-content"]');
  const shapes = page.locator(".pixel-shape-outer[data-testid^='pixel-shape-']");
  const activeShape = page.locator('[data-testid="pixel-shape-w-table-1"]');
  const peerShape = page.locator('[data-testid="pixel-shape-w-bar-1"]');

  await expect(activeShape).toBeVisible({ timeout: 15_000 });
  await expect(peerShape).toBeVisible({ timeout: 15_000 });
  await expect(shapes).toHaveCount(2);

  const contentBox = await content.boundingBox();
  expect(contentBox).not.toBeNull();
  if (contentBox) {
    expect(contentBox.width).toBeGreaterThan(400);
    expect(contentBox.height).toBeGreaterThan(300);
  }

  const before = await activeShape.evaluate((el) => ({
    outerWidth: el.clientWidth,
    outerHeight: el.clientHeight,
    containerWidth: el.querySelector(".pixel-shape-body")?.clientWidth ?? 0,
    containerHeight: el.querySelector(".pixel-shape-body")?.clientHeight ?? 0,
  }));
  expect(before.outerWidth).toBeGreaterThan(0);
  expect(before.containerWidth).toBeGreaterThan(0);

  await activeShape.click();
  const handle = page.getByTestId("pixel-resize-se");
  await expect(handle).toBeVisible({ timeout: 10_000 });
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 8 });
  await page.mouse.up();

  await expect
    .poll(async () => shapes.count())
    .toBe(2);

  for (const id of ["w-table-1", "w-bar-1"]) {
    const shape = page.locator(`[data-testid="pixel-shape-${id}"]`);
    await expect(shape).toBeVisible();
    const bbox = await shape.boundingBox();
    expect(bbox).not.toBeNull();
    if (bbox) {
      expect(bbox.width).toBeGreaterThan(50);
      expect(bbox.height).toBeGreaterThan(50);
    }
  }

  const afterContent = await content.boundingBox();
  expect(afterContent).not.toBeNull();
  if (afterContent) {
    expect(afterContent.width).toBeGreaterThan(400);
    expect(afterContent.height).toBeGreaterThan(300);
  }

  const after = await activeShape.evaluate((el) => ({
    outerWidth: el.clientWidth,
    outerHeight: el.clientHeight,
    containerWidth: el.querySelector(".pixel-shape-body")?.clientWidth ?? 0,
    containerHeight: el.querySelector(".pixel-shape-body")?.clientHeight ?? 0,
  }));

  expect(Math.abs(after.outerWidth - after.containerWidth)).toBeLessThanOrEqual(2);
  expect(Math.abs(after.outerHeight - after.containerHeight)).toBeLessThanOrEqual(2);
  expect(after.outerWidth).toBeGreaterThan(before.outerWidth);
  expect(after.containerWidth).toBeGreaterThan(before.containerWidth);
});
