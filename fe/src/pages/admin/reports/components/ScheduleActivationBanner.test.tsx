import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScheduleActivationBanner } from "./ScheduleActivationBanner";

afterEach(() => cleanup());

describe("ScheduleActivationBanner", () => {
  it("calls onActivate when 立即激活 is clicked", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<ScheduleActivationBanner onActivate={onActivate} />);
    await user.click(screen.getByRole("button", { name: "立即激活" }));
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it("shows delivery warning label on activate button", () => {
    render(
      <ScheduleActivationBanner
        onActivate={vi.fn()}
        deliveryWarning="SMTP 未配置或不可达"
      />,
    );
    expect(screen.getByRole("button", { name: "仍要激活" })).toBeInTheDocument();
    expect(screen.getByText(/SMTP 未配置或不可达/)).toBeInTheDocument();
  });

  it("disables button when activating", () => {
    render(<ScheduleActivationBanner onActivate={vi.fn()} activating />);
    expect(screen.getByRole("button", { name: "激活中…" })).toBeDisabled();
  });
});
