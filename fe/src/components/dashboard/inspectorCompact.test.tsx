import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ChartInspectorSection } from "./inspectorCompact";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

function ToggleSectionFixture({ initialEnabled = false }: { initialEnabled?: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);

  return (
    <ChartInspectorSection
      title="备注"
      enabled={enabled}
      action={
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label="显示备注"
        />
      }
    >
      <p>备注内容区</p>
    </ChartInspectorSection>
  );
}

describe("ChartInspectorSection", () => {
  it("expands when header switch turns on and collapses when off", async () => {
    const user = userEvent.setup();
    render(<ToggleSectionFixture />);

    expect(screen.queryByText("备注内容区")).not.toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "显示备注" }));
    expect(screen.getByText("备注内容区")).toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "显示备注" }));
    expect(screen.queryByText("备注内容区")).not.toBeInTheDocument();
  });

  it("starts expanded when enabled is initially true", () => {
    render(<ToggleSectionFixture initialEnabled />);
    expect(screen.getByText("备注内容区")).toBeInTheDocument();
  });
});
