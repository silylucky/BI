import { test, expect } from "@playwright/test";

test.describe("map-3d route smoke", () => {
  test.skip(({ baseURL }) => !baseURL, "requires dev server baseURL");

  test("map-3d chart host exposes render engine attribute", async ({ page }) => {
    await page.goto("/dev/charts?type=map-3d");
    const host = page.locator("[data-testid='three-map-chart']");
    await expect(host).toBeVisible({ timeout: 15_000 });
    const engine = await host.getAttribute("data-render-engine");
    expect(engine === "three" || engine === "d3-fallback" || engine === "pending").toBeTruthy();
  });
});
