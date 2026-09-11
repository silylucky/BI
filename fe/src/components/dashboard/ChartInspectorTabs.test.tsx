import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ChartInspectorTabs } from "./ChartInspectorTabs";

afterEach(() => cleanup());

describe("ChartInspectorTabs scroll", () => {
  it("uses h-0 flex scroll panel for tab content", () => {
    const { container } = render(
      <div className="flex h-[280px] min-h-0 flex-col overflow-hidden">
        <ChartInspectorTabs
          className="min-h-0 flex-1"
          tabs={["data", "style"]}
          data={<div style={{ height: 1200 }}>tall-data</div>}
          style={<div>style</div>}
        />
      </div>,
    );

    const panel = container.querySelector(".overflow-y-auto");
    expect(panel).toBeTruthy();
    expect(panel).toHaveClass("h-0");
    expect(panel).not.toHaveClass("touch-pan-y");
    expect(container.querySelector('[class*="h-0"][class*="flex-1"][class*="overflow-hidden"]')).toBeTruthy();
  });

  it("style tab panel stays constrained when nested in rail flex chain", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div className="flex h-[320px] min-h-0 flex-col overflow-hidden">
        <div className="flex h-full min-h-0 w-full overflow-hidden">
          <div className="flex h-0 min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <ChartInspectorTabs
                className="min-h-0 flex-1"
                tabs={["data", "style"]}
                data={<div>data</div>}
                style={<div style={{ height: 1600 }}>tall-style</div>}
              />
            </div>
          </div>
        </div>
      </div>,
    );

    await user.click(screen.getByRole("tab", { name: "样式" }));
    const panels = container.querySelectorAll(".overflow-y-auto");
    const stylePanel = panels[panels.length - 1];
    expect(stylePanel).toBeTruthy();
    expect(stylePanel).toHaveClass("h-0");
    expect(screen.getByText("tall-style")).toBeInTheDocument();
  });
});
