import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartPickerPopover } from "./ChartPickerPopover";
import { DASHBOARD_CHART_DND_TYPE, DASHBOARD_CUSTOM_VIZ_DND_TYPE } from "@/lib/dashboardDnd";

vi.mock("@/lib/chartRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chartRegistry")>();
  return {
    ...actual,
    fetchChartTypeCatalog: vi.fn(async () => [
      { type: "line", displayName: "基础折线图", library: "d3", paletteCategory: "trend" },
    ]),
  };
});

vi.mock("@/lib/aiVizArtifacts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/aiVizArtifacts")>();
  return {
    ...actual,
    fetchAiVizArtifacts: vi.fn(async () => ({
      items: [
        {
          artifactId: "art-custom-1",
          manifest: { displayName: "演示排名条", id: "ranking-strip" },
          status: "active",
          contentHash: "abc",
        },
        {
          artifactId: "0833b30b-39d4-4a58-80f6-030de7cbe377",
          manifest: { displayName: "排名条(带序号)-降序", id: "ranking-bar-medal-v1" },
          status: "active",
          contentHash: "medal",
        },
      ],
    })),
    fetchAiVizArtifactReferences: vi.fn(async () => ({
      artifactId: "art-custom-1",
      references: [],
    })),
    deleteAiVizArtifact: vi.fn(async () => undefined),
  };
});

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { username: "editor", roles: ["admin"], permissions: ["dashboard:edit"] },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.stubGlobal(
  "IntersectionObserver",
  vi.fn(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
  })),
);

function renderPicker(props: Partial<ComponentProps<typeof ChartPickerPopover>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ChartPickerPopover onInsert={vi.fn()} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("ChartPickerPopover isolated layout", () => {
  it("shows only the active section when layout is isolated", async () => {
    const user = userEvent.setup();
    renderPicker({ onInsertCustomViz: vi.fn(), layout: "isolated" });
    const popover = await screen.findByTestId("chart-picker-popover");

    expect(await within(popover).findByRole("button", { name: /基础折线图/i })).toBeInTheDocument();
    expect(within(popover).queryByRole("button", { name: "自定义" })).toBeInTheDocument();
    expect(within(popover).queryByTestId("custom-viz-tile-art-custom-1")).not.toBeInTheDocument();

    await user.click(within(popover).getByRole("button", { name: "自定义" }));
    expect(within(popover).queryByRole("button", { name: /基础折线图/i })).not.toBeInTheDocument();
    expect(await within(popover).findByTestId("custom-viz-tile-art-custom-1")).toBeInTheDocument();
  });
});

describe("ChartPickerPopover drag", () => {
  it("keeps drag payload and notifies drag session callbacks", async () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();

    renderPicker({ onPaletteDragStart: onDragStart, onPaletteDragEnd: onDragEnd });

    const popover = await screen.findByTestId("chart-picker-popover");
    const tile = await within(popover).findByRole("button", { name: /基础折线图/i });
    expect(tile.querySelector("svg")).toBeTruthy();
    const transfer = {
      types: [] as string[],
      effectAllowed: "none",
      setData(type: string, value: string) {
        this.types.push(type);
        (this as { _data?: Record<string, string> })._data = {
          ...(this as { _data?: Record<string, string> })._data,
          [type]: value,
        };
      },
      getData(type: string) {
        return (this as { _data?: Record<string, string> })._data?.[type] ?? "";
      },
    };

    fireEvent.dragStart(tile, { dataTransfer: transfer });
    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(transfer.types).toContain(DASHBOARD_CHART_DND_TYPE);
    expect(transfer.getData(DASHBOARD_CHART_DND_TYPE)).toBe("line");

    fireEvent.dragEnd(tile);
    expect(onDragEnd).toHaveBeenCalledTimes(1);
  });
});

describe("ChartPickerPopover custom viz", () => {
  it("shows 自定义 nav and artifact tile when onInsertCustomViz is provided", async () => {
    const onInsertCustomViz = vi.fn();
    renderPicker({ onInsertCustomViz });
    const popover = await screen.findByTestId("chart-picker-popover");

    expect(await within(popover).findByRole("button", { name: "自定义" })).toBeInTheDocument();
    expect(await within(popover).findByTestId("custom-viz-tile-art-custom-1")).toBeInTheDocument();
    expect(
      await within(popover).findByTestId("custom-viz-tile-0833b30b-39d4-4a58-80f6-030de7cbe377"),
    ).toBeInTheDocument();
  });

  it("calls onInsertCustomViz when custom tile is clicked", async () => {
    const onInsertCustomViz = vi.fn();
    const user = userEvent.setup();
    renderPicker({ onInsertCustomViz });
    const popover = await screen.findByTestId("chart-picker-popover");

    await user.click(await within(popover).findByTestId("custom-viz-tile-art-custom-1"));
    expect(onInsertCustomViz).toHaveBeenCalledWith({
      type: "customViz",
      artifactId: "art-custom-1",
      displayName: "演示排名条",
    });
  });

  it("highlights selected custom viz tile", async () => {
    renderPicker({
      onInsertCustomViz: vi.fn(),
      selectedCustomVizArtifactId: "art-custom-1",
    });
    const popover = await screen.findByTestId("chart-picker-popover");
    const selected = await within(popover).findByTestId("custom-viz-tile-art-custom-1");
    const other = await within(popover).findByTestId(
      "custom-viz-tile-0833b30b-39d4-4a58-80f6-030de7cbe377",
    );

    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(other).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onInsertCustomViz when ranking bar medal tile is clicked", async () => {
    const onInsertCustomViz = vi.fn();
    const user = userEvent.setup();
    renderPicker({ onInsertCustomViz });
    const popover = await screen.findByTestId("chart-picker-popover");

    await user.click(
      await within(popover).findByTestId("custom-viz-tile-0833b30b-39d4-4a58-80f6-030de7cbe377"),
    );
    expect(onInsertCustomViz).toHaveBeenCalledWith({
      type: "customViz",
      artifactId: "0833b30b-39d4-4a58-80f6-030de7cbe377",
      displayName: "排名条(带序号)-降序",
    });
  });

  it("sets custom viz drag payload on dragStart", async () => {
    renderPicker({ onInsertCustomViz: vi.fn() });
    const popover = await screen.findByTestId("chart-picker-popover");
    const tile = await within(popover).findByTestId("custom-viz-tile-art-custom-1");
    const transfer = {
      types: [] as string[],
      effectAllowed: "none",
      setData(type: string, value: string) {
        this.types.push(type);
        (this as { _data?: Record<string, string> })._data = {
          ...(this as { _data?: Record<string, string> })._data,
          [type]: value,
        };
      },
      getData(type: string) {
        return (this as { _data?: Record<string, string> })._data?.[type] ?? "";
      },
    };

    fireEvent.dragStart(tile, { dataTransfer: transfer });
    expect(transfer.types).toContain(DASHBOARD_CUSTOM_VIZ_DND_TYPE);
    expect(JSON.parse(transfer.getData(DASHBOARD_CUSTOM_VIZ_DND_TYPE))).toEqual({
      type: "customViz",
      artifactId: "art-custom-1",
      displayName: "演示排名条",
    });
  });

  it("does not fetch custom artifacts when onInsertCustomViz is omitted", async () => {
    const { fetchAiVizArtifacts } = await import("@/lib/aiVizArtifacts");
    vi.mocked(fetchAiVizArtifacts).mockClear();
    renderPicker();
    const popover = await screen.findByTestId("chart-picker-popover");

    expect(await within(popover).findByRole("button", { name: /基础折线图/i })).toBeInTheDocument();
    expect(fetchAiVizArtifacts).not.toHaveBeenCalled();
    expect(within(popover).queryByRole("button", { name: "自定义" })).not.toBeInTheDocument();
  });

  it("shows compliance warning badge and tier hint on custom viz tile", async () => {
    const { fetchAiVizArtifacts } = await import("@/lib/aiVizArtifacts");
    vi.mocked(fetchAiVizArtifacts).mockResolvedValueOnce({
      items: [
        {
          artifactId: "wild-1",
          manifest: { displayName: "野路子组件", id: "wild-v1" },
          status: "draft",
          contentHash: "wild",
          warnings: [
            {
              code: "AIVIZ_WARN_STYLE_COMPLIANCE",
              message: "bundle 未引用 payload.style 或 --vs-style-* / --vs-palette-*，样式面板与看板配色可能不会生效",
            },
          ],
          styleComplianceTier: "visual-only",
        },
      ],
    });

    renderPicker({ onInsertCustomViz: vi.fn() });
    const popover = await screen.findByTestId("chart-picker-popover");
    const tile = await within(popover).findByTestId("custom-viz-tile-wild-1");

    expect(within(tile).getByLabelText("样式合规警告")).toBeInTheDocument();
    expect(tile.getAttribute("title")).toContain("仅视觉");
    expect(tile.getAttribute("title")).toContain("样式面板与看板配色可能不会生效");
  });

  it("deletes artifact with unlink when dashboard references exist", async () => {
    const { deleteAiVizArtifact, fetchAiVizArtifactReferences } = await import("@/lib/aiVizArtifacts");
    const { toast } = await import("sonner");
    vi.mocked(fetchAiVizArtifactReferences).mockResolvedValueOnce({
      artifactId: "art-custom-1",
      references: [
        {
          dashboardId: "dash-1",
          dashboardName: "运营看板",
          widgetId: "w1",
        },
      ],
    });
    vi.mocked(deleteAiVizArtifact).mockResolvedValueOnce({
      artifactId: "art-custom-1",
      unlinked: [
        {
          dashboardId: "dash-1",
          dashboardName: "运营看板",
          removedWidgetIds: ["w1"],
        },
      ],
    });

    const user = userEvent.setup();
    renderPicker({ onInsertCustomViz: vi.fn() });
    const popover = await screen.findByTestId("chart-picker-popover");
    await user.click(
      within(popover).getByRole("button", { name: /从组件库移除 演示排名条/ }),
    );
    await user.click(await screen.findByRole("button", { name: "移除" }));

    expect(fetchAiVizArtifactReferences).toHaveBeenCalledWith("art-custom-1");
    expect(deleteAiVizArtifact).toHaveBeenCalledWith("art-custom-1", { unlink: true });
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows toast when artifact delete fails after confirm", async () => {
    const { deleteAiVizArtifact } = await import("@/lib/aiVizArtifacts");
    const { toast } = await import("sonner");
    vi.mocked(deleteAiVizArtifact).mockRejectedValueOnce(new Error("network"));

    const user = userEvent.setup();
    renderPicker({ onInsertCustomViz: vi.fn() });
    const popover = await screen.findByTestId("chart-picker-popover");
    await user.click(
      within(popover).getByRole("button", { name: /从组件库移除 演示排名条/ }),
    );
    await user.click(await screen.findByRole("button", { name: "移除" }));

    expect(deleteAiVizArtifact).toHaveBeenCalledWith("art-custom-1", { unlink: true });
    expect(toast.error).toHaveBeenCalled();
  });
});