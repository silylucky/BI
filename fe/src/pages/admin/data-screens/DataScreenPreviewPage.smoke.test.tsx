import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { DataScreenPreviewPage } from "./DataScreenPreviewPage";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(async () => ({
    id: "scr-1",
    name: "测试大屏",
    layoutJson: {
      version: 2,
      canvas: { width: 1920, height: 1080 },
      widgets: [],
      globalFilters: [],
      styleConfig: { surfaceKind: "data-screen", colorScheme: "dark", refreshIntervalSec: 30 },
    },
  })),
}));

describe("DataScreenPreviewPage smoke", () => {
  it("mounts chromeless preview route", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/data-screens/scr-1/preview"]}>
        <Routes>
          <Route path="/admin/data-screens/:id/preview" element={<DataScreenPreviewPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("测试大屏")).toBeInTheDocument();
    });
    expect(screen.getByText("返回编辑")).toBeInTheDocument();
    expect(screen.getByText("全屏")).toBeInTheDocument();
    expect(screen.getByTestId("screen-refresh-badge")).toBeInTheDocument();
  });
});
