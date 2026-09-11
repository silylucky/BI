import { expect, test } from "@playwright/test";

const LOGIN_BODY = {
  accessToken: "e2e-token",
  tokenType: "bearer",
  expiresIn: 3600,
};

function mockAuthApis(
  page: import("@playwright/test").Page,
  opts: {
    roles: string[];
    userViews: { items: Array<{ name?: string; dashboardId?: string }> };
    roleDefault: { dashboardId: string; inheritFromRoleId?: string | null };
  },
) {
  return Promise.all([
    page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(LOGIN_BODY),
      });
    }),
    page.route("**/api/v1/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "u1", username: "viewer1", roles: opts.roles }),
      });
    }),
    page.route("**/api/v1/users/me/views", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(opts.userViews),
      });
    }),
    page.route(`**/api/v1/roles/${opts.roles[0]}/default-views`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          dashboardId: opts.roleDefault.dashboardId,
          inheritFromRoleId: opts.roleDefault.inheritFromRoleId ?? null,
          maxWidgetCount: 24,
        }),
      });
    }),
  ]);
}

test("T-VIEW-E2E-001: login redirects to role default dashboard", async ({ page }) => {
  await mockAuthApis(page, {
    roles: ["viewer"],
    userViews: { items: [] },
    roleDefault: { dashboardId: "d-smoke-1" },
  });
  await page.goto("/login");
  await page.getByLabel("用户名").fill("viewer");
  await page.getByLabel("密码").fill("secret");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboards\/d-smoke-1/, { timeout: 15_000 });
});

test("T-VIEW-E2E-002: user override wins over role default", async ({ page }) => {
  await mockAuthApis(page, {
    roles: ["viewer"],
    userViews: { items: [{ dashboardId: "d-override", name: "我的看板" }] },
    roleDefault: { dashboardId: "d-smoke-1" },
  });
  await page.goto("/login");
  await page.getByLabel("用户名").fill("viewer");
  await page.getByLabel("密码").fill("secret");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboards\/d-override/, { timeout: 15_000 });
});

test("login form fits mobile viewport without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login");
  const card = page.locator("form");
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.width).toBeLessThanOrEqual(375);
  }
  await expect(page.getByRole("button", { name: "登录" })).toBeVisible();
});
