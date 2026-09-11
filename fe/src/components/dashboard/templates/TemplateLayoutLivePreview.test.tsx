import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TemplateLayoutLivePreview } from "./TemplateLayoutLivePreview";
import type { DashboardLayout } from "@/components/dashboard/layoutUtils";

vi.mock("@/components/dashboard/DashboardLayoutPreview", () => ({
  DashboardLayoutPreview: () => <div data-testid="dashboard-layout-preview-mock" />,
}));

vi.mock("@/components/dashboard/screen/DataScreenPresenter", () => ({
  DataScreenPresenter: () => <div data-testid="data-screen-presenter-mock" />,
}));

const pixelLayout: DashboardLayout = {
  version: 2,
  canvas: { width: 1440, height: 921 },
  widgets: [],
  globalFilters: [],
};

afterEach(() => {
  cleanup();
});

describe("TemplateLayoutLivePreview", () => {
  it("wraps pixel dashboard dialog preview in scale viewport", () => {
    render(
      <div className="h-[600px] w-[800px]">
        <TemplateLayoutLivePreview
          layout={pixelLayout}
          surfaceKind="dashboard"
          variant="dialog"
        />
      </div>,
    );
    expect(screen.getByTestId("template-layout-live-preview")).toHaveAttribute(
      "data-preview-variant",
      "dialog",
    );
    expect(
      screen.getByTestId("template-layout-live-preview").querySelector("[data-canvas-scale-viewport]"),
    ).toBeTruthy();
    expect(screen.getByTestId("dashboard-layout-preview-mock")).toBeInTheDocument();
  });
});
