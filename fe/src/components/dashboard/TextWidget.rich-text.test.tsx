import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextWidget } from "./TextWidget";
import type { LayoutWidget, TextWidgetConfig } from "./layoutUtils";

const widget = {
  id: "text-1",
  type: "text",
  title: "说明",
  colSpan: 6,
  rowSpan: 2,
  order: 0,
  textConfig: { content: "<p>旧内容</p>", variant: "html" },
} satisfies LayoutWidget & { textConfig: TextWidgetConfig };

describe("TextWidget inline editing", () => {
  afterEach(() => {
    cleanup();
  });

  it("single click selects but double click opens editor", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <TextWidget
        widget={widget}
        mode="edit"
        onSelect={onSelect}
        onTextConfigChange={vi.fn()}
      />,
    );
    const content = screen.getByTestId("text-widget-content");
    await user.click(content);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("textbox", { name: "富文本内容" })).toBeNull();
    await user.dblClick(content);
    expect(await screen.findByTestId("rich-text-floating-toolbar")).toBeVisible();
    await screen.findByRole("textbox", { name: "富文本内容" });
  });

  it("shows placeholder on hover only for empty content in edit mode", async () => {
    const user = userEvent.setup();
    render(
      <TextWidget
        widget={{ ...widget, textConfig: { content: "", variant: "html" } }}
        mode="edit"
      />,
    );
    const placeholder = screen.getByText("双击编辑文字");
    expect(placeholder).toHaveClass("hidden");
    await user.hover(screen.getByTestId("text-widget-content"));
    expect(placeholder).toHaveClass("group-hover/text-widget:flex");
  });

  it("hides empty placeholder in view mode", () => {
    render(
      <TextWidget
        widget={{ ...widget, textConfig: { content: "", variant: "html" } }}
        mode="view"
      />,
    );
    expect(screen.queryByText("双击编辑文字")).toBeNull();
  });

  it("never creates an editor in view mode", () => {
    render(<TextWidget widget={widget} mode="view" />);
    const content = screen.getByTestId("text-widget-content");
    expect(within(content).getByText("旧内容")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "富文本内容" })).toBeNull();
  });

  it("shape shell hides grid header chrome like DataEase shape-inner", () => {
    render(
      <TextWidget
        widget={widget}
        mode="edit"
        shell="shape"
        onTextConfigChange={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("富文本标题")).toBeNull();
    expect(screen.queryByLabelText("拖动以移动组件")).toBeNull();
    expect(within(screen.getByTestId("text-widget-content")).getByText("旧内容")).toBeVisible();
  });

  it("preserves widgetStyle and screenStyle when committing from outside click", async () => {
    const user = userEvent.setup();
    const onTextConfigChange = vi.fn();
    const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
    const styledWidget = {
      ...widget,
      textConfig: {
        content: "<p>旧内容</p>",
        variant: "html" as const,
        widgetStyle: {
          backgroundImage: dataUrl,
          backgroundImageFit: "stretch" as const,
        },
        screenStyle: {
          border: { presetId: "tech-ring" },
        },
      },
    } satisfies LayoutWidget & { textConfig: TextWidgetConfig };

    render(
      <TextWidget
        widget={styledWidget}
        mode="edit"
        shell="shape"
        onTextConfigChange={onTextConfigChange}
      />,
    );

    await user.dblClick(screen.getByTestId("text-widget-content"));
    await screen.findByRole("textbox", { name: "富文本内容" });

    document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

    expect(onTextConfigChange).toHaveBeenCalledOnce();
    const committed = onTextConfigChange.mock.calls[0]?.[1];
    expect(committed?.widgetStyle?.backgroundImage).toBe(dataUrl);
    expect(committed?.widgetStyle?.backgroundImageFit).toBe("stretch");
    expect(committed?.screenStyle).toEqual({ border: { presetId: "tech-ring" } });
    expect(committed?.content).toBe("<p>旧内容</p>");
    expect(committed?.variant).toBe("html");
  });
});
