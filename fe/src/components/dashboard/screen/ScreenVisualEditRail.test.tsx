import type { ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScreenVisualEditRail } from "./ScreenVisualEditRail";
import {
  createScreenBorderWidget,
  createScreenDateTimeWidget,
  createScreenIconWidget,
  createScreenShapeWidget,
  SCREEN_CLOCK_MARKER,
} from "@/lib/screenVisualAssets";
import type { LayoutWidget } from "@/components/dashboard/layoutUtils";

function asTextWidget(widget: LayoutWidget) {
  return widget as LayoutWidget & { textConfig: NonNullable<LayoutWidget["textConfig"]> };
}

function renderRail(props: ComponentProps<typeof ScreenVisualEditRail>) {
  return render(
    <TooltipProvider delayDuration={0}>
      <ScreenVisualEditRail {...props} />
    </TooltipProvider>,
  );
}

describe("ScreenVisualEditRail", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders style panel directly without data tab", () => {
    const borderWidget = asTextWidget(createScreenBorderWidget([], undefined, "border-1"));
    renderRail({ widget: borderWidget });

    expect(screen.queryByRole("tab", { name: "数据" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "样式" })).not.toBeInTheDocument();
    expect(screen.getByTestId("border-variant-select")).toBeInTheDocument();
  });

  it("renders widget shell background section for clock", () => {
    const clockWidget = asTextWidget({
      id: "clock-1",
      type: "text",
      title: "时钟",
      colSpan: 6,
      rowSpan: 1,
      order: 0,
      textConfig: { content: SCREEN_CLOCK_MARKER, variant: "plain" },
    });
    renderRail({ widget: clockWidget });
    expect(screen.getByRole("button", { name: "背景" })).toBeInTheDocument();
  });

  it("updates widget shell background from style panel", async () => {
    const user = userEvent.setup();
    const onTextConfigChange = vi.fn();
    const clockWidget = asTextWidget({
      id: "clock-1",
      type: "text",
      title: "时钟",
      colSpan: 6,
      rowSpan: 1,
      order: 0,
      textConfig: { content: SCREEN_CLOCK_MARKER, variant: "plain" },
    });

    renderRail({ widget: clockWidget, onTextConfigChange });

    await user.click(screen.getByRole("switch", { name: "启用背景" }));
    const lastCall = onTextConfigChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.widgetStyle?.backgroundShow).toBe(false);
  });

  it("updates clock style from style panel", async () => {
    const user = userEvent.setup();
    const onTextConfigChange = vi.fn();
    const clockWidget = asTextWidget({
      id: "clock-1",
      type: "text",
      title: "时钟",
      colSpan: 6,
      rowSpan: 1,
      order: 0,
      textConfig: { content: SCREEN_CLOCK_MARKER, variant: "plain" },
    });

    renderRail({ widget: clockWidget, onTextConfigChange });

    await user.click(screen.getByRole("combobox", { name: "时间字号" }));
    await user.click(screen.getByRole("option", { name: "24" }));

    const lastCall = onTextConfigChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.screenStyle?.clock?.fontSize).toBe(24);
  });

  it("updates border variant from style panel", async () => {
    const user = userEvent.setup();
    const onTextConfigChange = vi.fn();
    const borderWidget = asTextWidget(createScreenBorderWidget([], undefined, "border-1"));

    renderRail({ widget: borderWidget, onTextConfigChange });

    await user.click(screen.getByTestId("border-variant-select"));
    await user.click(screen.getByTestId("border-variant-border-3"));

    const lastCall = onTextConfigChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.screenStyle?.border?.variant).toBe("border-3");
  });

  it("updates shape type from style panel", async () => {
    const user = userEvent.setup();
    const onTextConfigChange = vi.fn();
    const shapeWidget = asTextWidget(createScreenShapeWidget([], undefined, "rect"));

    renderRail({ widget: shapeWidget, onTextConfigChange });

    await user.click(screen.getByRole("button", { name: "三角形" }));

    const lastCall = onTextConfigChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.screenStyle?.shape?.shape).toBe("triangle");
  });

  it("updates icon preset from style panel", async () => {
    const user = userEvent.setup();
    const onTextConfigChange = vi.fn();
    const iconWidget = asTextWidget(createScreenIconWidget([], undefined, "star"));

    renderRail({ widget: iconWidget, onTextConfigChange });

    await user.click(screen.getByTestId("icon-preset-home"));

    const lastCall = onTextConfigChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.screenStyle?.icon?.icon).toBe("home");
  });

  it("enables border sparkles from style panel", async () => {
    const user = userEvent.setup();
    const onTextConfigChange = vi.fn();
    const borderWidget = asTextWidget(createScreenBorderWidget([], undefined, "border-1"));

    renderRail({ widget: borderWidget, onTextConfigChange });

    await user.click(screen.getByRole("switch", { name: "边框流光" }));

    const lastCall = onTextConfigChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.screenStyle?.border?.sparkle?.enabled).toBe(true);
    expect(lastCall?.screenStyle?.border?.sparkle?.sparkles?.length).toBeGreaterThanOrEqual(1);
  });

  it("updates datetime weekday visibility from style panel", async () => {
    const user = userEvent.setup();
    const onTextConfigChange = vi.fn();
    const datetimeWidget = asTextWidget(createScreenDateTimeWidget([]));

    renderRail({ widget: datetimeWidget, onTextConfigChange });

    await user.click(screen.getByRole("switch", { name: "显示星期" }));

    const lastCall = onTextConfigChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.screenStyle?.datetime?.showWeekday).toBe(true);
  });
});
