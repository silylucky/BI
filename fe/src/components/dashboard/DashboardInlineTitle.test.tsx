import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardInlineTitle } from "./DashboardInlineTitle";

afterEach(() => cleanup());

function ControlledTitle({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <DashboardInlineTitle value={value} onChange={setValue} />;
}

describe("DashboardInlineTitle", () => {
  it("shows placeholder when name is empty", () => {
    render(<DashboardInlineTitle value="" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /看板名称：未命名看板/ })).toBeInTheDocument();
  });

  it("enters edit mode on title click and commits on Enter", async () => {
    const user = userEvent.setup();
    render(<ControlledTitle initial="销售看板" />);

    await user.click(screen.getByRole("button", { name: /看板名称：销售看板/ }));
    const input = screen.getByRole("textbox", { name: "看板名称" });
    await user.clear(input);
    await user.type(input, "经营看板{Enter}");

    expect(screen.getByRole("button", { name: /看板名称：经营看板/ })).toBeInTheDocument();
  });

  it("cancels edit on Escape", async () => {
    const user = userEvent.setup();
    render(<ControlledTitle initial="销售看板" />);

    const field = screen.getByTestId("dashboard-name-field");
    await user.click(within(field).getByLabelText("重命名看板"));
    const input = screen.getByRole("textbox", { name: "看板名称" });
    await user.clear(input);
    await user.type(input, "草稿{Escape}");

    expect(screen.getByRole("button", { name: /看板名称：销售看板/ })).toBeInTheDocument();
  });
});
