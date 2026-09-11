import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComponentPayloadPreview } from "./ComponentPayloadPreview";

vi.mock("./VizComponentThumbnailPreview", () => ({
  VizComponentThumbnailPreview: ({
    thumbnailUrl,
    widgetType,
  }: {
    thumbnailUrl?: string | null;
    widgetType: string;
  }) => (
    <div data-testid="viz-component-thumbnail-preview" data-widget-type={widgetType}>
      {thumbnailUrl ?? "no-thumbnail"}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
});

describe("ComponentPayloadPreview", () => {
  it("renders static thumbnail preview for hub cards", () => {
    render(
      <ComponentPayloadPreview
        widgetType="chart"
        thumbnailUrl="/api/v1/viz-components/c1/thumbnail?v=1"
      />,
    );
    const preview = screen.getByTestId("viz-component-thumbnail-preview");
    expect(preview).toHaveTextContent("/api/v1/viz-components/c1/thumbnail?v=1");
    expect(preview).toHaveAttribute("data-widget-type", "chart");
  });

  it("shows placeholder when thumbnail is missing", () => {
    render(<ComponentPayloadPreview widgetType="filter" />);
    expect(screen.getByTestId("viz-component-thumbnail-preview")).toHaveTextContent("no-thumbnail");
  });
});
