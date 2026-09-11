import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

const blobHook = vi.hoisted(() => ({
  impl: (path: string | null | undefined) => ({
    url: path ?? null,
    loading: false,
    error: false,
  }),
}));

vi.mock("@/hooks/useAuthenticatedBlobUrl", () => ({
  useAuthenticatedBlobUrl: (path: string | null | undefined) => blobHook.impl(path),
}));

import {
  DashboardListCard,
  type DashboardListItem,
} from "@/components/dashboard/DashboardListCard";
import { DASHBOARD_LIST_CARD_ASPECT_RATIO } from "@/components/dashboard/hubCardUi";

const tallCanvasDashboard: DashboardListItem = {
  id: "dash-tall",
  name: "高画布看板",
  slug: "dash-tall",
  updatedAt: "2026-07-14T12:00:00.000Z",
  layoutJson: {
    version: 2,
    canvas: { width: 1440, height: 4800 },
    widgets: [
      {
        id: "w1",
        type: "chart",
        title: "图表",
        order: 0,
        x: 100,
        y: 4200,
        width: 400,
        height: 300,
        chartConfig: {
          chartType: "bar",
          chartId: "w1",
          dataSourceId: "00000000-0000-4000-8000-000000000010",
          mode: "sql",
          sql: "SELECT 1",
        },
      },
    ],
    globalFilters: [],
  },
};

function renderCard(dashboard: DashboardListItem, props?: { previewSurfaceKind?: "dashboard" | "data-screen" }) {
  return render(
    <TooltipProvider delayDuration={0}>
      <MemoryRouter>
        <DashboardListCard dashboard={dashboard} canEdit {...props} />
      </MemoryRouter>
    </TooltipProvider>,
  );
}

describe("DashboardListCard", () => {
  afterEach(() => {
    cleanup();
    blobHook.impl = (path: string | null | undefined) => ({
      url: path ?? null,
      loading: false,
      error: false,
    });
  });

  it("hides official demo badge when title already contains 官方示例", () => {
    const { queryByText } = renderCard({
      id: "demo-1",
      name: "官方示例 · 双栏指标看板",
      slug: "官方示例-双栏指标看板",
      updatedAt: "2026-07-14T12:00:00.000Z",
      layoutJson: {
        version: 1,
        widgets: [],
        globalFilters: [],
        demoPackage: { seed: true, sourceTemplateKey: "builtin-dash-dual-kpi" },
      },
    });
    expect(queryByText("官方示例", { exact: true })).not.toBeInTheDocument();
  });

  it("shows official demo badge when demo instance was renamed", () => {
    const { getByText } = renderCard({
      id: "demo-1",
      name: "我的销售看板",
      slug: "官方示例-双栏指标看板",
      updatedAt: "2026-07-14T12:00:00.000Z",
      layoutJson: {
        version: 1,
        widgets: [],
        globalFilters: [],
        demoPackage: { seed: true, sourceTemplateKey: "builtin-dash-dual-kpi" },
      },
    });
    expect(getByText("官方示例")).toBeInTheDocument();
  });

  it("uses fixed list card aspect ratio regardless of canvas height", () => {
    const { container } = renderCard(tallCanvasDashboard);

    const preview = container.querySelector("article > div");
    expect(preview).toHaveStyle({ aspectRatio: DASHBOARD_LIST_CARD_ASPECT_RATIO });
  });

  it("forces data-screen preview ratio when previewSurfaceKind is set", () => {
    const { container } = renderCard(tallCanvasDashboard, { previewSurfaceKind: "data-screen" });

    const preview = container.querySelector("article > div");
    expect(preview).toHaveStyle({ aspectRatio: "16 / 9" });
  });

  it("renders authenticated screenshot image when thumbnailUrl is present", () => {
    renderCard({
      ...tallCanvasDashboard,
      thumbnailUrl: "/api/v1/dashboards/dash-tall/thumbnail?v=1",
    });

    const img = screen.getByTestId("dashboard-list-card-thumbnail");
    expect(img).toHaveAttribute("src", "/api/v1/dashboards/dash-tall/thumbnail?v=1");
    expect(screen.queryByTestId("dashboard-list-card-thumbnail-placeholder")).not.toBeInTheDocument();
  });

  it("shows screenshot placeholder when thumbnailUrl is missing", () => {
    renderCard(tallCanvasDashboard);

    expect(screen.queryByTestId("dashboard-list-card-thumbnail")).not.toBeInTheDocument();
    expect(screen.getByTestId("dashboard-list-card-thumbnail-placeholder")).toHaveTextContent(
      "保存后将生成封面截图",
    );
  });

  it("shows load-failed copy when authenticated blob fetch fails", () => {
    blobHook.impl = () => ({ url: null, loading: false, error: true });
    renderCard({
      ...tallCanvasDashboard,
      thumbnailUrl: "/api/v1/dashboards/dash-tall/thumbnail?v=1",
    });

    expect(screen.getByTestId("dashboard-list-card-thumbnail-placeholder")).toHaveTextContent(
      "封面截图加载失败，请重新保存",
    );
  });
});
