import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaEditRail } from "./MediaEditRail";
import { defaultMediaConfig, type LayoutWidget } from "./layoutUtils";

const baseWidget = {
  id: "mw-1",
  title: "宣传图",
  col: 0,
  row: 0,
  colSpan: 4,
  rowSpan: 3,
  type: "media" as const,
  mediaConfig: defaultMediaConfig(),
};

describe("MediaEditRail", () => {
  afterEach(() => cleanup());

  it("renders single-column tabs with collapse rail button", () => {
    const onRailCollapse = vi.fn();
    render(
      <MediaEditRail
        widget={baseWidget as LayoutWidget & { mediaConfig: typeof baseWidget.mediaConfig }}
        onChange={() => {}}
        onRailCollapse={onRailCollapse}
      />,
    );
    expect(screen.getByRole("tab", { name: "数据" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "样式" })).toBeInTheDocument();
    expect(screen.queryByText("预览")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起配置" })).toBeInTheDocument();
    expect(screen.getByText("图片来源")).toBeInTheDocument();
    expect(screen.getByText("宣传图")).toBeInTheDocument();
  });

  it("tab panels scroll inside the rail when content overflows", () => {
    const { container } = render(
      <div className="flex h-[320px] min-h-0 flex-col overflow-hidden">
        <MediaEditRail
          widget={baseWidget as LayoutWidget & { mediaConfig: typeof baseWidget.mediaConfig }}
          onChange={() => {}}
        />
      </div>,
    );
    const scrollPanel = container.querySelector(".overflow-y-auto");
    expect(scrollPanel).toBeTruthy();
  });

  it("style tab exposes background and image sections", async () => {
    const user = userEvent.setup();
    render(
      <MediaEditRail
        widget={baseWidget as LayoutWidget & { mediaConfig: typeof baseWidget.mediaConfig }}
        onChange={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "样式" }));
    const panel = screen.getByTestId("media-widget-style-panel");
    expect(panel).toBeInTheDocument();
    expect(within(panel).getByText("背景")).toBeInTheDocument();
    expect(within(panel).getByText("图片显示")).toBeInTheDocument();
    expect(within(panel).getByText("线框")).toBeInTheDocument();
  });

  it("style tab exposes fit segments", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MediaEditRail
        widget={baseWidget as LayoutWidget & { mediaConfig: typeof baseWidget.mediaConfig }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "样式" }));
    await user.click(screen.getByRole("button", { name: "覆盖" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ fit: "cover" }));
  });
});
