import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DashboardStyleSurface } from "./DashboardStyleSurface";

afterEach(cleanup);

describe("DashboardStyleSurface", () => {
  it("scopes theme only and does not paint canvas background on the wrapper", () => {
    render(
      <DashboardStyleSurface styleConfig={{ canvasBackground: "#f1c40f" }}>
        <span data-testid="child">canvas</span>
      </DashboardStyleSurface>,
    );
    const surface = screen.getByTestId("child").parentElement;
    expect(surface).toHaveAttribute("data-canvas-user-bg", "true");
    expect(surface).toHaveAttribute("data-dashboard-color-scheme", "light");
    expect(surface).toHaveStyle({ colorScheme: "light" });
    expect(surface).not.toHaveStyle({ background: "#f1c40f" });
  });

  it("applies dark theme class without coupling to user background", () => {
    render(
      <DashboardStyleSurface
        styleConfig={{ colorScheme: "dark", canvasBackground: "#f1c40f" }}
      >
        <span data-testid="child">canvas</span>
      </DashboardStyleSurface>,
    );
    const surface = screen.getByTestId("child").parentElement;
    expect(surface).toHaveClass("dark");
    expect(surface).toHaveAttribute("data-dashboard-color-scheme", "dark");
    expect(surface).toHaveStyle({ colorScheme: "dark" });
    expect(surface).not.toHaveStyle({ background: "#f1c40f" });
  });

  it("keeps light dashboard scope without dark class when html is dark", () => {
    document.documentElement.classList.add("dark");
    render(
      <DashboardStyleSurface styleConfig={{ colorScheme: "light" }}>
        <span data-testid="probe" className="bg-white dark:bg-gray-900" />
      </DashboardStyleSurface>,
    );
    const scope = screen.getByTestId("probe").parentElement;
    expect(scope).toHaveClass("dashboard-theme-scope");
    expect(scope).not.toHaveClass("dark");
    expect(scope).toHaveAttribute("data-dashboard-color-scheme", "light");
    document.documentElement.classList.remove("dark");
  });

  it("applies dark class on scope when colorScheme is dark with html light", () => {
    render(
      <DashboardStyleSurface styleConfig={{ colorScheme: "dark" }}>
        <span data-testid="probe" />
      </DashboardStyleSurface>,
    );
    const scope = screen.getByTestId("probe").parentElement;
    expect(scope).toHaveClass("dark");
    expect(scope).toHaveAttribute("data-dashboard-color-scheme", "dark");
  });
});
