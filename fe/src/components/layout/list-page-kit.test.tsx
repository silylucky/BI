import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DeleteRowIconButton, ListPageTableFrame } from "@/components/layout/list-page-kit";

describe("ListPageTableFrame", () => {
  it("allows vertical scrolling inside fill-layout list pages", () => {
    render(
      <ListPageTableFrame>
        <p>列表内容</p>
      </ListPageTableFrame>,
    );

    const frame = screen.getByText("列表内容").parentElement;
    expect(frame?.className).toContain("overflow-y-auto");
    expect(frame?.className).toContain("flex-1");
    expect(frame?.className).not.toContain("overflow-hidden");
  });
});

describe("DeleteRowIconButton", () => {
  it("renders slash overlay when disabled", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <DeleteRowIconButton label="删除示例" disabled disabledTitle="不可删除" />
      </TooltipProvider>,
    );

    const button = screen.getByRole("button", { name: "删除示例" });
    expect(button).toBeDisabled();
    expect(button.querySelector("span.rotate-\\[-45deg\\]")).toBeTruthy();
  });

  it("calls onClick when enabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <TooltipProvider delayDuration={0}>
        <DeleteRowIconButton label="删除自定义" onClick={onClick} />
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "删除自定义" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
