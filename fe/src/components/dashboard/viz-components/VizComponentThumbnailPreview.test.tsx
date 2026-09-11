import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VizComponentThumbnailPreview } from "./VizComponentThumbnailPreview";

const mockUseAuthenticatedBlobUrl = vi.fn();

vi.mock("@/hooks/useAuthenticatedBlobUrl", () => ({
  useAuthenticatedBlobUrl: (...args: unknown[]) => mockUseAuthenticatedBlobUrl(...args),
}));

afterEach(() => {
  cleanup();
  mockUseAuthenticatedBlobUrl.mockReset();
});

describe("VizComponentThumbnailPreview", () => {
  it("renders authenticated screenshot when blob url is ready", () => {
    mockUseAuthenticatedBlobUrl.mockReturnValue({
      url: "blob:preview",
      loading: false,
      error: null,
    });
    render(
      <VizComponentThumbnailPreview
        widgetType="chart"
        thumbnailUrl="/api/v1/viz-components/c1/thumbnail?v=1"
      />,
    );
    expect(screen.getByTestId("viz-component-thumbnail")).toHaveAttribute("src", "blob:preview");
  });

  it("shows placeholder when thumbnail url is missing", () => {
    mockUseAuthenticatedBlobUrl.mockReturnValue({
      url: null,
      loading: false,
      error: null,
    });
    render(<VizComponentThumbnailPreview widgetType="chart" />);
    expect(screen.getByTestId("viz-component-thumbnail-placeholder")).toBeInTheDocument();
    expect(screen.getByText("暂无封面，请保存或批量生成")).toBeInTheDocument();
  });
});
