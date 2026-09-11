import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextEditRail } from "./TextEditRail";
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

function renderRail() {
  return render(
    <TextEditRail
      widget={widget}
      onTitleChange={vi.fn()}
      onConfigChange={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
}

describe("TextEditRail", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders style panel without fake dataset binding", () => {
    renderRail();

    expect(screen.getByText("富文本")).toBeVisible();
    expect(screen.queryByRole("tab", { name: "数据" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "选择数据集" })).not.toBeInTheDocument();
    expect(screen.getByText(/在画布双击编辑正文/)).toBeVisible();
    expect(screen.getByTestId("text-widget-style-panel")).toBeInTheDocument();
    expect(screen.getByText("背景")).toBeVisible();
    expect(screen.getByText("正文")).toBeVisible();
  });
});
