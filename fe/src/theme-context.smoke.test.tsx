import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./context/theme-context";

function ThemeProbe() {
  return <div data-testid="probe">theme</div>;
}

describe("ThemeProvider smoke", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("falls back to light when localStorage.theme is invalid (T-FE-30)", async () => {
    localStorage.setItem("theme", "garbage");
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    await vi.waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  it("defaults to light when localStorage.theme is missing (T-FE-31)", async () => {
    localStorage.removeItem("theme");
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    await vi.waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });
});
