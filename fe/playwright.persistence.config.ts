import { defineConfig, devices } from "@playwright/test";

/** 持久化 E2E：真实 FastAPI + Vite，不 mock 保存 API。本地需 backend:8000 + fe:5173。 */
export default defineConfig({
  testDir: "./e2e/persistence",
  timeout: 120_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
