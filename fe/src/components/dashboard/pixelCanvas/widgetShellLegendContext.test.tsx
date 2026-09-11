import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  WidgetShellLegendProvider,
  usePublishWidgetShellLegend,
  useWidgetShellLegend,
} from "./widgetShellLegendContext";

function PublishProbe({
  enabled,
  visible,
}: {
  enabled: boolean;
  visible: boolean;
}) {
  usePublishWidgetShellLegend(
    {
      visible,
      position: "bottom",
      orient: "horizontal",
      hAlign: "center",
      vAlign: "bottom",
      fontSize: 12,
      icon: "triangle",
      iconSize: 6,
      items: visible ? [{ name: "A", color: "#465fff" }] : [],
    },
    enabled,
  );
  return null;
}

function StateCounter() {
  const ctx = useWidgetShellLegend();
  return <span data-testid="visible">{ctx?.state.visible ? "1" : "0"}</span>;
}

describe("widgetShellLegendContext", () => {
  it("does not loop when publishing the same legend state", () => {
    let renderCount = 0;

    function App() {
      renderCount += 1;
      return (
        <WidgetShellLegendProvider>
          <PublishProbe enabled visible />
          <StateCounter />
        </WidgetShellLegendProvider>
      );
    }

    render(<App />);
    const afterMount = renderCount;
    act(() => {
      /* flush effects */
    });
    expect(renderCount).toBeLessThanOrEqual(afterMount + 2);
    expect(renderCount).toBeLessThan(10);
  });
});
