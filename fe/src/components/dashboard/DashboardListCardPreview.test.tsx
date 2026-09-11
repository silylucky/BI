import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardLayoutV2 } from "@/components/dashboard/layoutUtils";
import {
  beginAdminNavTransition,
  endAdminNavTransition,
  resetAdminNavTransitionForTests,
} from "@/lib/adminHeavyRenderSuspend";
import {
  MAX_LIST_PREVIEW_ACTIVATIONS,
  resetListPreviewActivationForTests,
} from "@/lib/listPreviewActivation";
import { DashboardListCardPreview } from "./DashboardListCardPreview";

const dataScreenPresenterSpy = vi.fn();

vi.mock("./DashboardLayoutPreview", () => ({
  DashboardLayoutPreview: (props: { previewProfile?: string }) => (
    <div data-testid="dashboard-layout-preview-mock" data-preview-profile={props.previewProfile} />
  ),
}));

vi.mock("./screen/DataScreenPresenter", () => ({
  DataScreenPresenter: (props: { previewProfile?: string }) => {
    dataScreenPresenterSpy(props);
    return (
      <div
        data-testid="data-screen-presenter-mock"
        data-preview-profile={props.previewProfile}
      />
    );
  },
}));

vi.mock("@/hooks/useDashboardListCardLayout", () => ({
  useDashboardListCardLayout: () => ({
    data: undefined,
    isLoading: false,
    isFetching: false,
  }),
}));

const sampleLayout: DashboardLayoutV2 = {
  version: 2,
  canvas: { width: 1920, height: 1080 },
  styleConfig: { surfaceKind: "data-screen" },
  widgets: [
    {
      id: "w1",
      type: "chart",
      title: "图表",
      order: 0,
      x: 100,
      y: 80,
      width: 600,
      height: 360,
      chartConfig: {
        chartType: "line",
        dataSourceId: "ds-1",
      },
    },
  ],
  globalFilters: [],
};

describe("DashboardListCardPreview", () => {
  afterEach(() => {
    cleanup();
    resetAdminNavTransitionForTests();
    resetListPreviewActivationForTests();
    dataScreenPresenterSpy.mockClear();
  });

  beforeEach(() => {
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 320,
      height: 180,
      top: 0,
      left: 0,
      right: 320,
      bottom: 180,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }));
  });

  it("shows empty icon when dashboard has no widgets", () => {
    const { container } = render(
      <DashboardListCardPreview
        layoutJson={{ version: 2, canvas: { width: 1440, height: 900 }, widgets: [], globalFilters: [] }}
      />,
    );
    expect(container.querySelector("svg")).toBeTruthy();
    expect(screen.getByTestId("dashboard-list-card-preview")).toBeInTheDocument();
  });

  it("renders live data screen preview with card profile when eager", () => {
    render(<DashboardListCardPreview layoutJson={sampleLayout} eager />);
    expect(screen.getByTestId("dashboard-list-card-live-preview")).toBeInTheDocument();
    expect(screen.getByTestId("data-screen-presenter-mock")).toHaveAttribute(
      "data-preview-profile",
      "card",
    );
    expect(screen.getByTestId("dashboard-list-card-preview")).toHaveAttribute(
      "data-preview-profile",
      "card",
    );
  });

  it("shows skeleton until live preview is ready in viewport", () => {
    render(<DashboardListCardPreview layoutJson={sampleLayout} />);
    expect(screen.getByTestId("dashboard-list-card-preview-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-list-card-live-preview")).toBeNull();
  });

  it("recovers live preview after nav suspend ends while in viewport", async () => {
    beginAdminNavTransition();
    const { rerender } = render(<DashboardListCardPreview layoutJson={sampleLayout} />);
    expect(screen.queryByTestId("dashboard-list-card-live-preview")).toBeNull();

    endAdminNavTransition();
    rerender(<DashboardListCardPreview layoutJson={sampleLayout} />);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-list-card-live-preview")).toBeInTheDocument();
    });
    expect(dataScreenPresenterSpy.mock.calls.at(-1)?.[0]?.previewProfile).toBe("card");
  });

  it("grants live preview when many cards are visible in viewport", async () => {
    const cards = Array.from({ length: MAX_LIST_PREVIEW_ACTIVATIONS }, (_, index) => (
      <DashboardListCardPreview
        key={`dash-${index}`}
        dashboardId={`dash-${index}`}
        layoutJson={sampleLayout}
      />
    ));
    render(<div>{cards}</div>);

    await waitFor(() => {
      expect(screen.getAllByTestId("dashboard-list-card-live-preview").length).toBe(
        MAX_LIST_PREVIEW_ACTIVATIONS,
      );
    });
  });

  it("unmounts live preview when card scrolls out of viewport", async () => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        private readonly callback: IntersectionObserverCallback;
        constructor(callback: IntersectionObserverCallback) {
          this.callback = callback;
        }
        observe() {
          this.callback(
            [{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
        }
        disconnect() {}
      },
    );
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 320,
      height: 180,
      top: 2000,
      left: 0,
      right: 320,
      bottom: 2180,
      x: 0,
      y: 2000,
      toJSON: () => ({}),
    }));

    render(<DashboardListCardPreview dashboardId="off-screen" layoutJson={sampleLayout} />);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-list-card-preview")).toHaveAttribute(
        "data-live",
        "false",
      );
    });
    expect(screen.queryByTestId("dashboard-list-card-live-preview")).toBeNull();
  });
});
