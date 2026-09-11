import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChartEmbedShareActions } from "@/components/dashboard/ChartEmbedShareActions";
import { PublicShareLinkCard } from "@/components/dashboard/PublicShareLinkCard";
import { EmbedChartPage } from "./EmbedChartPage";
import { EmbedScreenPage } from "./EmbedScreenPage";

const mockApiFetch = vi.fn();
const mockFetch = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

vi.mock("@/components/charts/ChartRenderer", () => ({
  ChartRenderer: ({ title, embedded }: { title?: string; embedded?: boolean }) => (
    <div data-testid="chart-mock" data-embedded={embedded ? "1" : "0"}>
      {title}
    </div>
  ),
}));

vi.mock("@/components/dashboard/screen/DataScreenPresenter", () => ({
  DataScreenPresenter: ({ layout }: { layout: { version?: number } }) => (
    <div data-testid="screen-mock">screen-v{layout.version ?? 1}</div>
  ),
}));

vi.mock("@/components/dashboard/screen/useScreenAutoRefresh", () => ({
  useScreenAutoRefresh: () => ({ globalChartRefreshKey: 0 }),
}));

describe("embed share loop", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("ChartEmbedShareActions: issue public link → URL with token and shareMode", async () => {
    mockApiFetch.mockResolvedValue({
      embedUrl: "/embed/chart/ch-1?token=pub-tok&shareMode=public",
    });
    render(<ChartEmbedShareActions chartId="ch-1" mode="public" />);
    await userEvent.click(screen.getByRole("button", { name: "生成公开链接" }));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/embed/token", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ chartId: "ch-1", shareMode: "public", theme: "light" }),
      }));
    });
    expect(screen.getByText(/token=pub-tok/)).toBeInTheDocument();
    expect(screen.getByText(/shareMode=public/)).toBeInTheDocument();
  });

  it("PublicShareLinkCard: issue dashboard public link", async () => {
    mockApiFetch.mockResolvedValue({
      embedUrl: "/embed/screen/dash-1?token=scr-tok&shareMode=public",
    });
    render(<PublicShareLinkCard dashboardId="dash-1" name="测试看板" variant="card" />);
    await userEvent.click(screen.getByRole("button", { name: "生成公开链接" }));
    expect(await screen.findByText(/\/embed\/screen\/dash-1/)).toBeInTheDocument();
  });

  it("EmbedChartPage: missing token shows honest error", () => {
    render(
      <MemoryRouter initialEntries={["/embed/chart/ch-1"]}>
        <Routes>
          <Route path="/embed/chart/:chartId" element={<EmbedChartPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/缺少嵌入令牌/)).toBeInTheDocument();
  });

  it("EmbedChartPage: public token loads chart without login", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        chartType: "bar",
        chartId: "ch-1",
        dataSourceId: "00000000-0000-4000-8000-000000000010",
        mode: "sql",
        sql: "SELECT 1",
      }),
    });
    render(
      <MemoryRouter initialEntries={["/embed/chart/ch-1?token=pub-tok&shareMode=public"]}>
        <Routes>
          <Route path="/embed/chart/:chartId" element={<EmbedChartPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("chart-mock")).toBeInTheDocument();
    expect(screen.getByTestId("chart-mock")).toHaveAttribute("data-embedded", "1");
    expect(document.querySelector("[data-embed-chart]")).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/embed/chart-view?token=pub-tok&chartId=ch-1"),
    );
  });

  it("EmbedScreenPage: public token loads layout", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "dash-1",
        name: "大屏",
        layoutJson: { version: 2, canvas: { width: 1920, height: 1080 }, widgets: [] },
      }),
    });
    render(
      <MemoryRouter initialEntries={["/embed/screen/dash-1?token=scr-tok&shareMode=public"]}>
        <Routes>
          <Route path="/embed/screen/:dashboardId" element={<EmbedScreenPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("screen-mock")).toHaveTextContent("screen-v2");
  });
});
