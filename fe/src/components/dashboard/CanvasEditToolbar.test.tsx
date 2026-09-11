import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CanvasEditToolbar } from "./CanvasEditToolbar";
import { ScreenMorePicker } from "./screen/ScreenMorePicker";
import { createPaletteWidget } from "./createLayoutWidget";
import {
  DASHBOARD_SCREEN_INSERT_DND_TYPE,
  readPaletteDragPayload,
  setScreenInsertDragData,
} from "@/lib/dashboardDnd";

describe("CanvasEditToolbar screen materials", () => {
  it("shows datetime and webpage under more and categorized library under 素材库", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();

    render(
      <CanvasEditToolbar
        onInsert={onInsert}
        showScreenVisualAssets
        onAuxiliaryGridChange={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId("toolbar-more-toggle"));
    expect(screen.getByTestId("screen-more-datetime")).toBeInTheDocument();
    expect(screen.getByTestId("screen-more-webpage")).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /时钟/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /边框/ })).not.toBeInTheDocument();

    await user.click(screen.getByTestId("screen-more-datetime"));
    expect(onInsert).toHaveBeenCalledWith("screen-datetime");

    await user.click(screen.getByTestId("toolbar-insert-screen-material"));
    expect(screen.getByTestId("screen-material-category-border")).toBeInTheDocument();
    expect(screen.getByTestId("screen-material-border-1")).toBeInTheDocument();
  });

  it("marks datetime and webpage tiles as draggable", () => {
    render(<ScreenMorePicker onInsert={vi.fn()} />);

    expect(screen.getByTestId("screen-more-datetime")).toHaveAttribute("draggable", "true");
    expect(screen.getByTestId("screen-more-webpage")).toHaveAttribute("draggable", "true");
  });

  it("wires screen-title-bar insert through createPaletteWidget like DashboardEditPage", () => {
    const widgets: ReturnType<typeof createPaletteWidget>[] = [];
    const onInsert = vi.fn((type: Parameters<typeof createPaletteWidget>[0]) => {
      widgets.push(createPaletteWidget(type, widgets));
    });

    render(
      <CanvasEditToolbar
        onInsert={onInsert}
        showScreenVisualAssets
        onAuxiliaryGridChange={vi.fn()}
      />,
    );

    onInsert("screen-title-bar");
    expect(onInsert).toHaveBeenCalledWith("screen-title-bar");
    expect(widgets).toHaveLength(1);
    expect(widgets[0]?.textConfig?.widgetStyle?.backgroundImage).toContain(
      "borderless-decor-v1",
    );
  });

  it("serializes screen insert drag payload", () => {
    const transfer = {
      types: [] as string[],
      data: new Map<string, string>(),
      effectAllowed: "none",
      setData(type: string, value: string) {
        this.data.set(type, value);
        if (!this.types.includes(type)) this.types.push(type);
      },
      getData(type: string) {
        return this.data.get(type) ?? "";
      },
    };

    setScreenInsertDragData(transfer as unknown as DataTransfer, "screen-webpage");
    expect(transfer.types).toContain(DASHBOARD_SCREEN_INSERT_DND_TYPE);
    expect(readPaletteDragPayload({ dataTransfer: transfer } as DragEvent)).toBe("screen-webpage");
  });
});
