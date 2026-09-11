import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

describe("Select empty content", () => {
  it("opens even when SelectContent has no items", async () => {
    const user = userEvent.setup();
    render(
      <Select>
        <SelectTrigger aria-label="dataset">
          <SelectValue placeholder="选择 Dataset" />
        </SelectTrigger>
        <SelectContent />
      </Select>,
    );
    const trigger = screen.getByRole("combobox", { name: "dataset" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
