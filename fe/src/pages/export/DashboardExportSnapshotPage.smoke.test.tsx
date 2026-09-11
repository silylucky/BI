import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardExportSnapshotPage } from "./DashboardExportSnapshotPage";

vi.mock("@/lib/exportSnapshot", () => ({
  fetchExportLayout: vi.fn(),
}));

vi.mock("@/components/dashboard/DashboardLayoutPreview", () => ({
  DashboardLayoutPreview: () => <div data-testid="layout-preview">preview</div>,
}));

vi.mock("@/components/dashboard/screen/DataScreenPresenter", () => ({
  DataScreenPresenter: () => <div data-testid="screen-presenter">screen</div>,
}));

import { fetchExportLayout } from "@/lib/exportSnapshot";

describe("DashboardExportSnapshotPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  it("shows error when token missing", async () => {
    render(
      <MemoryRouter initialEntries={["/export/dashboard/d1"]}>
        <Routes>
          <Route path="/export/dashboard/:id" element={<DashboardExportSnapshotPage surface="dashboard" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("缺少 export token")).toBeInTheDocument();
  });

  it("loads layout when token present", async () => {
    vi.mocked(fetchExportLayout).mockResolvedValue({
      id: "d1",
      name: "Demo",
      surfaceKind: "dashboard",
      layoutJson: { version: 1, widgets: [], globalFilters: [] },
    });
    render(
      <MemoryRouter initialEntries={["/export/dashboard/d1?token=abc"]}>
        <Routes>
          <Route path="/export/dashboard/:id" element={<DashboardExportSnapshotPage surface="dashboard" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("layout-preview")).toBeInTheDocument();
    expect(screen.getAllByText(/高清整页/).length).toBeGreaterThan(0);
    expect(document.querySelector('[data-export-layout-mode="full_page"]')).toBeTruthy();
  });

  it("shows per-widget mode banner and pages", async () => {
    vi.mocked(fetchExportLayout).mockResolvedValue({
      id: "d1",
      name: "Demo",
      surfaceKind: "dashboard",
      layoutJson: {
        version: 1,
        widgets: [
          { id: "w1", type: "text", title: "A", textConfig: { content: "x" }, colSpan: 6, rowSpan: 2 },
          { id: "w2", type: "text", title: "B", textConfig: { content: "y" }, colSpan: 6, rowSpan: 2 },
        ],
        globalFilters: [],
      },
    });
    render(
      <MemoryRouter initialEntries={["/export/dashboard/d1?token=abc&layoutMode=per_widget"]}>
        <Routes>
          <Route path="/export/dashboard/:id" element={<DashboardExportSnapshotPage surface="dashboard" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect((await screen.findAllByText(/按组件分页/)).length).toBeGreaterThan(0);
    expect(document.querySelectorAll("[data-export-widget-page]").length).toBe(2);
    expect((await screen.findAllByTestId("layout-preview")).length).toBe(2);
  });

  it("shows combined mode with overview and enlarged sections", async () => {
    vi.mocked(fetchExportLayout).mockResolvedValue({
      id: "d1",
      name: "Demo",
      surfaceKind: "dashboard",
      layoutJson: {
        version: 1,
        widgets: [
          { id: "w1", type: "text", title: "A", textConfig: { content: "x" }, colSpan: 6, rowSpan: 2 },
        ],
        globalFilters: [],
      },
    });
    render(
      <MemoryRouter initialEntries={["/export/dashboard/d1?token=abc&layoutMode=combined"]}>
        <Routes>
          <Route path="/export/dashboard/:id" element={<DashboardExportSnapshotPage surface="dashboard" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/第一部分：整页总览/)).toBeInTheDocument();
    expect(screen.getByText(/第二部分：组件放大明细/)).toBeInTheDocument();
    expect(document.querySelector(".export-widget-page-enlarged")).toBeTruthy();
  });

  it("sets data-export-ready after layout settle delay", async () => {
    vi.mocked(fetchExportLayout).mockResolvedValue({
      id: "d1",
      name: "Demo",
      surfaceKind: "dashboard",
      layoutJson: { version: 1, widgets: [], globalFilters: [] },
    });
    render(
      <MemoryRouter initialEntries={["/export/dashboard/d1?token=abc"]}>
        <Routes>
          <Route path="/export/dashboard/:id" element={<DashboardExportSnapshotPage surface="dashboard" />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByTestId("layout-preview");
    expect(document.querySelector("[data-export-snapshot]")).toBeTruthy();
    await waitFor(
      () => {
        expect(document.querySelector('[data-export-ready="true"]')).toBeTruthy();
      },
      { timeout: 2000 },
    );
  });
});
