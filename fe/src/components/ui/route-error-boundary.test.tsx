import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteErrorBoundary } from "./route-error-boundary";

function BoomPage() {
  throw new Error("route boom");
}

function OkPage() {
  return <p>页面正常</p>;
}

describe("RouteErrorBoundary", () => {
  afterEach(() => cleanup());

  it("isolates route crash and keeps shell content", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={["/bad"]}>
        <div data-testid="shell">
          <aside>侧栏</aside>
          <RouteErrorBoundary>
            <Routes>
              <Route path="/bad" element={<BoomPage />} />
            </Routes>
          </RouteErrorBoundary>
        </div>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("shell")).toBeInTheDocument();
    expect(screen.getByText("侧栏")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("页面加载失败");
    expect(screen.getByRole("alert")).toHaveTextContent("route boom");

    consoleError.mockRestore();
  });

  it("recovers after retry on same route", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let shouldThrow = true;

    function MaybeBoom() {
      if (shouldThrow) throw new Error("temporary");
      return <p>已恢复</p>;
    }

    render(
      <MemoryRouter initialEntries={["/x"]}>
        <RouteErrorBoundary>
          <Routes>
            <Route path="/x" element={<MaybeBoom />} />
          </Routes>
        </RouteErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByText("页面加载失败")).toBeInTheDocument();
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(screen.getByText("已恢复")).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("guides dev stale dynamic import failures to full reload", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });

    function LazyFail() {
      throw new Error(
        "Failed to fetch dynamically imported module: http://localhost:5174/src/pages/foo.tsx",
      );
    }

    render(
      <MemoryRouter initialEntries={["/lazy"]}>
        <RouteErrorBoundary>
          <Routes>
            <Route path="/lazy" element={<LazyFail />} />
          </Routes>
        </RouteErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("强制刷新");
    fireEvent.click(screen.getByRole("button", { name: "刷新页面" }));
    expect(reload).toHaveBeenCalled();

    vi.unstubAllGlobals();
    consoleError.mockRestore();
  });
});
