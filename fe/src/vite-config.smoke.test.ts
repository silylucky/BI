import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const configSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../vite.config.ts"),
  "utf8",
);

describe("vite.config smoke", () => {
  it("proxies /api to backend dev server (T-FE-18)", () => {
    expect(configSource).toContain('target: "http://localhost:8000"');
    expect(configSource).toContain('"/api"');
  });

  it("includes vitest jsdom environment (T-FE-18b)", () => {
    expect(configSource).toMatch(/environment:\s*["']jsdom["']/);
  });
});
