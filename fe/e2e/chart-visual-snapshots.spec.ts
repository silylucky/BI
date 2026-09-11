import { test, expect } from "@playwright/test";

/** VCDS 视觉回归基线：12 型图表 smoke 截图（容差 2%） */
const CHART_SNAPSHOT_ROUTES = [
  "/dev/charts?type=line",
  "/dev/charts?type=column",
  "/dev/charts?type=pie",
  "/dev/charts?type=scatter",
  "/dev/charts?type=map",
  "/dev/charts?type=table-normal",
] as const;

test.describe("chart visual snapshots", () => {
  test.skip(({ baseURL }) => !baseURL, "requires dev server baseURL");

  for (const route of CHART_SNAPSHOT_ROUTES) {
    test(`snapshot ${route}`, async ({ page }) => {
      await page.goto(route);
      const chart = page.locator("[data-testid='d3-chart-canvas'], [data-testid='d3-table-chart']").first();
      await expect(chart).toBeVisible({ timeout: 15_000 });
      await expect(chart).toHaveScreenshot(`${route.replace(/[^a-z0-9]+/gi, "-")}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });

    test(`snapshot ${route} depth-standard`, async ({ page }) => {
      await page.goto(`${route}&depthVisual=standard`);
      const chart = page.locator("[data-testid='d3-chart-canvas'], [data-testid='d3-table-chart']").first();
      await expect(chart).toBeVisible({ timeout: 15_000 });
      await expect(chart).toHaveScreenshot(`${route.replace(/[^a-z0-9]+/gi, "-")}-depth-standard.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
