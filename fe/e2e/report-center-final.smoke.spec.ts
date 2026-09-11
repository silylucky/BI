import { expect, test, type Page } from "@playwright/test";

const ADMIN_USER = {
  id: "e2e-admin",
  username: "admin",
  displayName: "Admin",
  email: "admin@example.com",
  roles: ["admin"],
  isRoot: true,
};

async function mockReportCenterApis(page: Page) {
  await page.route("**/api/v1/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(ADMIN_USER),
    });
  });
  await page.route("**/api/v1/reports/center/preferences", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          favorites: [{ resourceType: "standard", resourceId: "equipment-overview" }],
          recent: [
            {
              resourceType: "template",
              resourceId: "tpl-1",
              resourceLabel: "月报模板",
              viewedAt: "2026-08-07T10:00:00Z",
            },
          ],
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ favorites: [], recent: [] }),
    });
  });
  await page.route("**/api/v1/reports/schedules**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "sched-1",
            sourceType: "dashboard",
            sourceId: "d1",
            sourceLabel: "销售看板",
            cron: "0 8 * * *",
            timezone: "Asia/Shanghai",
            status: "scheduled",
            allowedActions: ["pause"],
            recipients: [{ type: "email", value: "ops@example.com" }],
            attachmentFormats: ["pdf"],
          },
        ],
        total: 1,
      }),
    });
  });
  await page.route("**/api/v1/reports/executions/recent-failures**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], total: 0 }),
    });
  });
  await page.route("**/api/v1/reports/standard/packs", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            packKey: "equipment-overview",
            displayName: "设备标准分析",
            enabledThemes: ["lifecycle"],
          },
        ],
        total: 1,
      }),
    });
  });
  await page.route("**/api/v1/reports/catalog/templates/readiness", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [{ nodeId: "tpl-1", readiness: "demo" }] }),
    });
  });
  await page.route("**/api/v1/reports/catalog/nodes**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "tpl-1",
          name: "月报模板",
          parentId: null,
          nodeType: "template",
          templateKind: "pdf",
          templateKey: "monthly",
          sortOrder: 0,
        },
      ]),
    });
  });
}

async function openReportCenter(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("vs_access_token", "e2e-token");
  });
  await mockReportCenterApis(page);
  await page.goto("/admin/reports/center");
}

test.describe("report center final smoke", () => {
  test("hub shows schedules, standard analysis and recent views", async ({ page }) => {
    await openReportCenter(page);
    await expect(page.getByRole("heading", { name: /报表中心/i })).toBeVisible();
    await expect(page.getByText("销售看板")).toBeVisible();
    await expect(page.getByText("设备标准分析")).toBeVisible();
    await expect(page.getByText("最近访问")).toBeVisible();
    await expect(page.getByText("月报模板")).toBeVisible();
  });

  test("expands document templates section", async ({ page }) => {
    await openReportCenter(page);
    await page.getByRole("button", { name: /文档模板/i }).click();
    await expect(page.getByText("月报模板")).toBeVisible();
    await expect(page.getByRole("link", { name: /打开/i })).toBeVisible();
  });

  test("mobile viewport renders without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openReportCenter(page);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
    await expect(page.getByRole("heading", { name: /报表中心/i })).toBeVisible();
  });
});
