import { expect, test } from "@playwright/test";

const adminBase = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173";
const apiBase = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:8000";

test.describe("dashboard persistence", () => {
  test.skip(
    !process.env.PLAYWRIGHT_PERSISTENCE,
    "set PLAYWRIGHT_PERSISTENCE=1 with backend+fe running",
  );

  test("login → save layout field survives reload", async ({ page, request }) => {
    const login = await request.post(`${apiBase}/api/v1/auth/login`, {
      data: { username: "admin", password: process.env.VITALSPAN_DEV_ADMIN_PASSWORD ?? "changeme" },
    });
    expect(login.ok()).toBeTruthy();
    const { accessToken } = await login.json();
    const headers = { Authorization: `Bearer ${accessToken}` };

    const dash = await request.post(`${apiBase}/api/v1/dashboards`, {
      headers,
      data: { name: `E2E ${Date.now()}`, slug: `e2e-${Date.now()}` },
    });
    expect(dash.ok()).toBeTruthy();
    const { id } = await dash.json();

    const layout = {
      version: 2,
      canvas: { width: 1440, height: 900 },
      widgets: [],
      styleConfig: { canvasBackgroundImageFit: "contain" },
    };
    const save = await request.put(`${apiBase}/api/v1/dashboards/${id}/editor-save`, {
      headers,
      data: {
        name: "E2E Saved",
        layoutJson: layout,
        globalFilters: {
          dashboardId: id,
          filters: [],
          linkageRules: [],
          refreshMode: "eager",
        },
      },
    });
    expect(save.ok()).toBeTruthy();

    const reload = await request.get(`${apiBase}/api/v1/dashboards/${id}`, { headers });
    expect(reload.ok()).toBeTruthy();
    const body = await reload.json();
    expect(body.name).toBe("E2E Saved");
    expect(body.layoutJson.styleConfig.canvasBackgroundImageFit).toBe("contain");

    await page.goto(`${adminBase}/admin/login`);
    await page.evaluate((token) => localStorage.setItem("vs_access_token", token), accessToken);
    await page.goto(`${adminBase}/admin/dashboards/${id}/edit`);
    await expect(page.getByRole("button", { name: "保存" })).toBeVisible();
  });
});
