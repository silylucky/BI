import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardContextInspector } from "./DashboardContextInspector";

afterEach(() => {
  cleanup();
});

describe("DashboardContextInspector", () => {
  it("renders dashboard config sections and toggles color scheme", async () => {
    const user = userEvent.setup();
    const onStyleChange = vi.fn();

    render(
      <DashboardContextInspector
        widgetCount={2}
        widgets={[]}
        styleConfig={{ gapPreset: "md", colorScheme: "light" }}
        onStyleChange={onStyleChange}
        embedded
        isPixelLayout
      />,
    );

    expect(screen.getByTestId("dashboard-config-inspector")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-config-inspector").querySelector(".dashboard-edit-rail-scroll")).toBeNull();
    expect(screen.getByTestId("dashboard-theme-section")).toBeInTheDocument();
    expect(screen.getByText("仪表板风格")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-overall-config")).toBeInTheDocument();
    expect(screen.getByText("整体配置")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-linkage-section")).not.toBeInTheDocument();
    expect(screen.queryByText("高级样式设置")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "深色主题" }));
    expect(onStyleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        colorScheme: "dark",
        canvasBackground: expect.any(String),
      }),
    );
  });

  it("resets all colors to the active theme from the theme style panel", async () => {
    const user = userEvent.setup();
    const onStyleChange = vi.fn();
    const onWidgetsChange = vi.fn();

    render(
      <DashboardContextInspector
        widgetCount={1}
        widgets={[
          {
            id: "w1",
            type: "chart",
            title: "柱图",
            colSpan: 6,
            rowSpan: 4,
            chartConfig: {
              chartType: "bar",
              dataSourceId: "ds1",
              nativeBody: {
                deStyle: { title: { color: "#ff0000" } },
              },
            },
          },
        ]}
        styleConfig={{
          colorScheme: "light",
          titleStyle: { color: "#884422" },
          canvasBackground: "#ffeedd",
          canvasBackgroundCustom: true,
        }}
        onStyleChange={onStyleChange}
        onWidgetsChange={onWidgetsChange}
        embedded
        isPixelLayout
      />,
    );

    await user.click(screen.getByRole("button", { name: "重置为当前主题默认" }));
    await user.click(screen.getByRole("button", { name: "确认重置" }));
    expect(onStyleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        colorScheme: "light",
        canvasBackground: expect.not.stringMatching(/ffeedd/i),
        titleStyle: expect.objectContaining({ color: expect.any(String) }),
      }),
    );
    expect(onWidgetsChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          chartConfig: expect.objectContaining({
            nativeBody: expect.objectContaining({
              deStyle: expect.not.objectContaining({
                title: expect.objectContaining({ color: "#ff0000" }),
              }),
            }),
          }),
        }),
      ]),
    );
  });

  it("emits scaleMode when switching zoom mode", async () => {
    const user = userEvent.setup();
    const onStyleChange = vi.fn();
    render(
      <DashboardContextInspector
        widgetCount={1}
        widgets={[]}
        styleConfig={{ scaleMode: "canvas" }}
        onStyleChange={onStyleChange}
        embedded
        isPixelLayout
      />,
    );

    await user.click(screen.getByRole("button", { name: "整体配置" }));
    await user.click(screen.getByRole("button", { name: "组件比例" }));
    expect(onStyleChange).toHaveBeenCalledWith(
      expect.objectContaining({ scaleMode: "component" }),
    );
  });

  it("shows custom gap controls and emits gapPreset custom for pixel layout", async () => {
    const user = userEvent.setup();
    const onStyleChange = vi.fn();

    render(
      <DashboardContextInspector
        widgetCount={1}
        widgets={[]}
        styleConfig={{ gapPreset: "md", pixelGutter: 5, colorScheme: "light" }}
        onStyleChange={onStyleChange}
        embedded
        isPixelLayout
      />,
    );

    await user.click(screen.getByRole("button", { name: "整体配置" }));
    await user.click(screen.getByRole("button", { name: "自定义" }));
    expect(onStyleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        gapPreset: "custom",
        pixelGutter: 3,
      }),
    );

    onStyleChange.mockClear();
    cleanup();
    render(
      <DashboardContextInspector
        widgetCount={1}
        widgets={[]}
        styleConfig={{ gapPreset: "custom", pixelGutter: 3, colorScheme: "light" }}
        onStyleChange={onStyleChange}
        embedded
        isPixelLayout
      />,
    );

    await user.click(screen.getByRole("button", { name: "整体配置" }));
    expect(screen.getByTestId("dashboard-gap-custom-controls")).toBeInTheDocument();
    const slider = screen.getByRole("slider", { name: "自定义间隙滑块" });
    expect(slider).toHaveValue("3");

    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: "7" } });
    expect(onStyleChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        gapPreset: "custom",
        pixelGutter: 7,
      }),
    );

    fireEvent.change(slider, { target: { value: "12" } });
    expect(onStyleChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        gapPreset: "custom",
        pixelGutter: 12,
      }),
    );

    fireEvent.pointerUp(slider);
    expect(onStyleChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        gapPreset: "custom",
        pixelGutter: 12,
      }),
    );
  });

  it("shows DE-style number format section with preview", async () => {
    const user = userEvent.setup();
    render(
      <DashboardContextInspector
        widgetCount={1}
        widgets={[]}
        styleConfig={{ numberFormat: { type: "auto", thousandSeparator: true } }}
        onStyleChange={vi.fn()}
        embedded
        isPixelLayout
      />,
    );

    await user.click(screen.getByRole("button", { name: /数字内容格式/ }));
    expect(screen.getByTestId("dashboard-number-format")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-number-format-preview")).toHaveTextContent(
      "示例20,000,000",
    );
  });

  it("shows chart style section with image and decorative border tabs", async () => {
    const user = userEvent.setup();
    render(
      <DashboardContextInspector
        widgetCount={1}
        widgets={[]}
        styleConfig={{ widgetStyle: { backgroundShow: true } }}
        onStyleChange={vi.fn()}
        embedded
        isPixelLayout
      />,
    );

    expect(screen.getByTestId("dashboard-widget-chart-style")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "组件外观" }));
    expect(screen.getByRole("button", { name: "图片" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "装饰边框" })).toBeInTheDocument();
    expect(screen.getByText("线框")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "图表配色" }));
    expect(screen.getByRole("switch", { name: "渐变颜色" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "显示图表标签" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "显示图表提示" })).toBeInTheDocument();
    expect(screen.getByText("表格配色")).toBeInTheDocument();
  });

  it("shows linkage section when dashboard linkage props are provided", async () => {
    const user = userEvent.setup();
    render(
      <DashboardContextInspector
        widgetCount={2}
        widgets={[
          {
            id: "w1",
            type: "chart",
            title: "A",
            colSpan: 6,
            rowSpan: 1,
            order: 0,
          },
        ]}
        styleConfig={{ gapPreset: "md" }}
        onStyleChange={vi.fn()}
        onLinkageChange={vi.fn()}
        dashboardId="d1"
        linkage={{
          filters: [{ filterId: "f1", dimensionRef: "区域", defaultValue: "华东" }],
          linkageRules: [],
        }}
        embedded
      />,
    );

    expect(screen.getByTestId("dashboard-linkage-section")).toBeInTheDocument();
    expect(screen.getByText("源筛选器")).toBeInTheDocument();
  });
});
