import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GovernanceHonestyBanner } from "./GovernanceHonestyBanner";

describe("GovernanceHonestyBanner", () => {
  afterEach(() => cleanup());

  it("shows honesty copy for deep-link governance surfaces", () => {
    render(<GovernanceHonestyBanner />);
    expect(screen.getByTestId("gov-honesty-banner")).toBeInTheDocument();
    expect(screen.getByText("未对接真实总线 / 差异化能力")).toBeInTheDocument();
  });
});
