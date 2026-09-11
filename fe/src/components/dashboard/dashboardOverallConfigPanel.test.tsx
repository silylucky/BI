import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardOverallConfigPanel } from "./dashboardOverallConfigPanel";

afterEach(cleanup);

describe("DashboardOverallConfigPanel", () => {
  it("patches chrome.showAuxiliaryGrid from 辅助对齐网格 toggle", async () => {
    const user = userEvent.setup();
    const patchStyle = vi.fn();

    render(
      <DashboardOverallConfigPanel
        styleConfig={{}}
        patchStyle={patchStyle}
        isPixelLayout
      />,
    );

    expect(screen.getByText("辅助对齐网格")).toBeInTheDocument();
    expect(screen.queryByTestId("alignment-snap-controls")).not.toBeVisible();

    await user.click(screen.getByRole("switch", { name: "辅助对齐网格" }));

    expect(patchStyle).toHaveBeenCalledWith({
      chrome: { showAuxiliaryGrid: false },
    });
  });

  it("patches alignment snap toggles for pixel layout", async () => {
    const user = userEvent.setup();
    const patchStyle = vi.fn();

    render(
      <DashboardOverallConfigPanel
        styleConfig={{}}
        patchStyle={patchStyle}
        isPixelLayout
      />,
    );

    await user.click(screen.getByRole("button", { name: "展开对齐吸附设置" }));

    await user.click(screen.getByRole("switch", { name: "组件对齐吸附" }));

    expect(patchStyle).toHaveBeenCalledWith({
      chrome: {
        alignmentSnap: {
          enableMarkLineSnap: false,
        },
      },
    });
  });

  it("patches mark line threshold from 吸附灵敏度 slider", async () => {
    const user = userEvent.setup();
    const patchStyle = vi.fn();

    render(
      <DashboardOverallConfigPanel
        styleConfig={{}}
        patchStyle={patchStyle}
        isPixelLayout
      />,
    );

    await user.click(screen.getByRole("button", { name: "展开对齐吸附设置" }));
    const slider = screen.getByRole("slider", { name: "吸附灵敏度" });
    fireEvent.change(slider, { target: { value: "16" } });

    expect(patchStyle).toHaveBeenCalledWith({
      chrome: {
        alignmentSnap: {
          markLineThresholdPx: 16,
        },
      },
    });
  });

  it("collapses alignment snap details by default on pixel layout", () => {
    render(
      <DashboardOverallConfigPanel
        styleConfig={{}}
        patchStyle={vi.fn()}
        isPixelLayout
      />,
    );

    expect(screen.getByTestId("alignment-snap-section")).toBeInTheDocument();
    expect(screen.queryByTestId("alignment-snap-controls")).not.toBeVisible();
  });

  it("hides alignment snap details on grid layout", () => {
    render(
      <DashboardOverallConfigPanel
        styleConfig={{}}
        patchStyle={vi.fn()}
        isPixelLayout={false}
      />,
    );

    expect(screen.getByText("辅助对齐网格")).toBeInTheDocument();
    expect(screen.queryByTestId("alignment-snap-controls")).not.toBeInTheDocument();
  });

  it("patches widgetStyle border from 组件线框 controls", async () => {
    const user = userEvent.setup();
    const patchStyle = vi.fn();
    const styleConfig = { widgetStyle: { borderEnabled: true, borderWidth: 1 } };

    render(
      <DashboardOverallConfigPanel
        styleConfig={styleConfig}
        patchStyle={patchStyle}
        isPixelLayout
      />,
    );

    const lineBorderField = screen.getByText("组件线框").closest("div")!.parentElement!;
    await user.click(within(lineBorderField).getByRole("switch", { name: "显示线框" }));

    expect(patchStyle).toHaveBeenCalledWith(expect.any(Function));
    const patchFn = patchStyle.mock.calls[0][0] as (prev: typeof styleConfig) => Partial<typeof styleConfig>;
    expect(
      patchFn({ widgetStyle: { borderEnabled: true, borderWidth: 1 } }),
    ).toEqual({
      widgetStyle: expect.objectContaining({ borderEnabled: false }),
    });
  });
});
