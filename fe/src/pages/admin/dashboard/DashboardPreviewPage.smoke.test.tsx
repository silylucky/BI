import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { DashboardPreviewPage } from "./DashboardPreviewPage";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: vi.fn(async () => ({
      id: "dash-1",
      name: "测试看板",
      layoutJson: {
        version: 2,
        canvas: { width: 1440, height: 900 },
        widgets: [],
        globalFilters: [],
        styleConfig: { colorScheme: "light" },
      },
    })),
  };
});

vi.mock("@/components/dashboard/screen/DataScreenPresenter", () => ({
  DataScreenPresenter: () => <div data-testid="dashboard-preview-canvas" />,
}));

describe("DashboardPreviewPage smoke", () => {
  it("mounts chromeless preview route", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/dashboards/dash-1/preview"]}>
        <Routes>
          <Route path="/admin/dashboards/:id/preview" element={<DashboardPreviewPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("测试看板")).toBeInTheDocument();
    });
    expect(screen.getByText("返回编辑")).toBeInTheDocument();
    expect(screen.getByText("全屏")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-preview-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("screen-refresh-badge")).toBeInTheDocument();
  });
});
