import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SegmentGroup } from "./segment-group";

describe("SegmentGroup", () => {
  afterEach(() => cleanup());

  it("renders options and calls onChange", async () => {
    const onChange = vi.fn();
    render(
      <SegmentGroup
        value="a"
        onChange={onChange}
        options={[
          { value: "a", label: "选项 A" },
          { value: "b", label: "选项 B" },
        ]}
      />,
    );

    expect(screen.getByRole("radio", { name: "选项 A" })).toHaveAttribute("aria-checked", "true");
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "选项 B" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
