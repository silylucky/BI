import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { defaultChartConfig } from "./layoutUtils";
import {
  DashboardWidgetContextMenu,
  WidgetContextMenuContent,
} from "./WidgetContextMenu";

const chartWidget = {
  id: "w-chart",
  type: "chart" as const,
  title: "图表",
  locked: false,
  chartConfig: defaultChartConfig("bar"),
};

const textWidget = {
  id: "w-text",
  type: "text" as const,
  title: "文本",
  locked: false,
  textConfig: { content: "hello", variant: "plain" as const },
};

const customVizWidget = {
  id: "w-custom-viz",
  type: "customViz" as const,
  title: "自定义",
  locked: false,
  customVizConfig: {
    artifactId: "550e8400-e29b-41d4-a716-446655440000",
    dataBinding: { status: "manual" as const },
  },
};

describe("DashboardWidgetContextMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("mounts context menu root around widget body", () => {
    render(
      <DashboardWidgetContextMenu
        widget={chartWidget}
        actions={{ onCopy: vi.fn(), onDelete: vi.fn(), surface: "dashboard" }}
        selected
      >
        <div data-testid="widget-body">chart</div>
      </DashboardWidgetContextMenu>,
    );

    expect(screen.getByTestId("widget-body")).toHaveAttribute("data-state", "closed");
  });

  it("runs copy/paste/delete and chart actions from open menu", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    const onPaste = vi.fn();
    const onDelete = vi.fn();
    const onEnlarge = vi.fn();
    const onViewData = vi.fn();

    render(
      <DashboardWidgetContextMenu
        widget={chartWidget}
        actions={{
          onCopy,
          onPaste,
          clipboardReady: true,
          onDelete,
          onEnlarge,
          onViewData,
          surface: "dashboard",
        }}
        selected
        open
      >
        <div data-testid="widget-body">chart</div>
      </DashboardWidgetContextMenu>,
    );

    const menu = screen.getByTestId("widget-context-menu-w-chart");
    await user.click(within(menu).getByText("复制"));
    await user.click(within(menu).getByText("粘贴"));
    await user.click(within(menu).getByText("放大"));
    await user.click(within(menu).getByText("查看数据"));
    await user.click(within(menu).getByText("删除"));

    expect(onCopy).toHaveBeenCalledWith("w-chart");
    expect(onPaste).toHaveBeenCalled();
    expect(onEnlarge).toHaveBeenCalledWith("w-chart");
    expect(onViewData).toHaveBeenCalledWith("w-chart");
    expect(onDelete).toHaveBeenCalledWith("w-chart");
    expect(within(menu).queryByText("导出为")).not.toBeInTheDocument();
  });

  it("runs view-data action for customViz widgets", async () => {
    const user = userEvent.setup();
    const onViewData = vi.fn();

    render(
      <DashboardWidgetContextMenu
        widget={customVizWidget}
        actions={{
          onCopy: vi.fn(),
          onDelete: vi.fn(),
          onViewData,
          surface: "dashboard",
        }}
        selected
        open
      >
        <div data-testid="widget-body">custom viz</div>
      </DashboardWidgetContextMenu>,
    );

    const menu = screen.getByTestId("widget-context-menu-w-custom-viz");
    await user.click(within(menu).getByText("查看数据"));
    expect(onViewData).toHaveBeenCalledWith("w-custom-viz");
  });

  it("disables paste when clipboard is empty", () => {
    render(
      <DashboardWidgetContextMenu
        widget={chartWidget}
        actions={{ onCopy: vi.fn(), onPaste: vi.fn(), onDelete: vi.fn(), surface: "dashboard" }}
        selected
        open
      >
        <div data-testid="widget-body">chart</div>
      </DashboardWidgetContextMenu>,
    );

    expect(screen.getByText("粘贴").closest("[data-disabled]")).toBeTruthy();
  });

  it("selects widget before opening when not selected", () => {
    const onSelect = vi.fn();

    render(
      <DashboardWidgetContextMenu
        widget={textWidget}
        actions={{ onCopy: vi.fn(), onDelete: vi.fn(), surface: "dashboard" }}
        selected={false}
        onSelect={onSelect}
      >
        <div data-testid="widget-body">text</div>
      </DashboardWidgetContextMenu>,
    );

    fireEvent.contextMenu(screen.getByTestId("widget-body"));

    expect(onSelect).toHaveBeenCalledWith("w-text", false);
  });
});

describe("WidgetContextMenuContent", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows dashboard quick style submenu", async () => {
    const user = userEvent.setup();

    render(
      <ContextMenu open>
        <ContextMenuTrigger asChild>
          <span>trigger</span>
        </ContextMenuTrigger>
        <ContextMenuContent data-testid="menu-content">
          <WidgetContextMenuContent
            widget={chartWidget}
            actions={{ onCopy: vi.fn(), onStyleQuickAction: vi.fn(), surface: "dashboard" }}
          />
        </ContextMenuContent>
      </ContextMenu>,
    );

    await user.click(within(screen.getByTestId("menu-content")).getByText("快捷样式"));
    expect(await screen.findByText("隐藏标题")).toBeInTheDocument();
    expect(screen.getByText("隐藏背景")).toBeInTheDocument();
    expect(screen.getByText("隐藏边框")).toBeInTheDocument();
    expect(screen.getByText("隐藏图例")).toBeInTheDocument();
    expect(screen.getByText("显示标签")).toBeInTheDocument();
    expect(screen.getByText("图表配色")).toBeInTheDocument();
  });

  it("shows data-screen quick style items", async () => {
    const user = userEvent.setup();

    render(
      <ContextMenu open>
        <ContextMenuTrigger asChild>
          <span>trigger</span>
        </ContextMenuTrigger>
        <ContextMenuContent data-testid="menu-content">
          <WidgetContextMenuContent
            widget={chartWidget}
            actions={{ onCopy: vi.fn(), onStyleQuickAction: vi.fn(), surface: "data-screen" }}
          />
        </ContextMenuContent>
      </ContextMenu>,
    );

    await user.click(within(screen.getByTestId("menu-content")).getByText("快捷样式"));
    expect(await screen.findByText("开启毛玻璃")).toBeInTheDocument();
    expect(screen.getByText("实体背景")).toBeInTheDocument();
    expect(screen.getByText("隐藏边框")).toBeInTheDocument();
  });

  it("shows data-screen layer shortcuts", () => {
    render(
      <ContextMenu open>
        <ContextMenuTrigger asChild>
          <span>trigger</span>
        </ContextMenuTrigger>
        <ContextMenuContent data-testid="menu-content">
          <WidgetContextMenuContent
            widget={{ ...textWidget, hidden: false, locked: false }}
            actions={{
              surface: "data-screen",
              onMoveLayerUp: vi.fn(),
              onMoveLayerDown: vi.fn(),
              onBringToFront: vi.fn(),
              onSendToBack: vi.fn(),
              onToggleHidden: vi.fn(),
              onToggleLocked: vi.fn(),
            }}
          />
        </ContextMenuContent>
      </ContextMenu>,
    );

    const menu = screen.getByTestId("menu-content");
    expect(within(menu).getByText("上移一层")).toBeInTheDocument();
    expect(within(menu).getByText("下移一层")).toBeInTheDocument();
    expect(within(menu).getByText("置顶")).toBeInTheDocument();
    expect(within(menu).getByText("置底")).toBeInTheDocument();
    expect(within(menu).getByText("隐藏图层")).toBeInTheDocument();
    expect(within(menu).getByText("锁定图层")).toBeInTheDocument();
  });
});
