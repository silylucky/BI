import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RadioChoiceGroup } from "./radio-choice-group";

describe("RadioChoiceGroup", () => {
  afterEach(() => cleanup());

  it("renders hints and switches selection", async () => {
    const onChange = vi.fn();
    render(
      <RadioChoiceGroup
        name="附件格式"
        value="pdf"
        onChange={onChange}
        options={[
          { value: "pdf", label: "PDF", hint: "适合打印" },
          { value: "xlsx", label: "Excel", hint: "可二次编辑" },
        ]}
      />,
    );

    expect(screen.getByText("适合打印")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "PDF" })).toHaveAttribute("aria-checked", "true");

    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "Excel" }));
    expect(onChange).toHaveBeenCalledWith("xlsx");
  });
});
