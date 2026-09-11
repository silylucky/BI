import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeSegmentGroup } from "./dashboardInspectorUi";
import { HORIZONTAL_ALIGN_SEGMENT_OPTIONS } from "./inspectorSegmentIcons";

afterEach(cleanup);

describe("DeSegmentGroup icon options", () => {
  it("renders aria labels for horizontal align icons", () => {
    render(
      <DeSegmentGroup
        value="left"
        options={HORIZONTAL_ALIGN_SEGMENT_OPTIONS}
        columns={3}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "左对齐" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "居中对齐" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "右对齐" })).toBeInTheDocument();
    expect(screen.queryByText("左")).not.toBeInTheDocument();
  });
});
