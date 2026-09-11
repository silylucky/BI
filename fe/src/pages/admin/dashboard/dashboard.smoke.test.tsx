import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  Route,
  Routes,
  useNavigate,
} from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "1", username: "admin", roles: ["admin"] },
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
    refresh: vi.fn(async () => {}),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { DASHBOARD_CHART_DND_TYPE, setChartTypeDragData } from "@/lib/dashboardDnd";
import { ApiRequestError } from "@/lib/api";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { DashboardWidget } from "@/components/dashboard/DashboardWidget";
import { WidgetInspectorDelete } from "@/components/dashboard/widget-inspector-delete";
import { gridLayoutToWidgets, normalizeWidgetLayout, widgetsToGridLayout } from "@/components/dashboard/gridLayoutAdapter";
import { snapLayoutToGrid } from "@/components/dashboard/gridSnapUtils";
import { LinkageRulesPanel } from "@/components/dashboard/LinkageRulesPanel";
import {
  defaultChartConfig,
  moveWidget,
  sortWidgets,
  type LayoutWidget,
} from "@/components/dashboard/layoutUtils";
import { WidgetPalette } from "@/components/dashboard/WidgetPalette";
import { DashboardEditWorkspace } from "@/components/dashboard/DashboardEditWorkspace";
import { createPaletteWidget } from "@/components/dashboard/createLayoutWidget";
import { resetChartTypeCatalogCache } from "@/lib/chartRegistry";
import { DashboardEditPage } from "./DashboardEditPage";
import { DashboardListPage } from "./DashboardListPage";

const mockApiFetch = vi.fn();
const DS_ID = "00000000-0000-4000-8000-000000000010";

const EMPTY_LINKAGE = { filters: [], linkageRules: [] as { sourceFilterId: string; targetWidgetIds: string[]; parameterKey: string }[] };

function mockGlobalFiltersPath(path: string): typeof EMPTY_LINKAGE | null {
  if (path.includes("/global-filters")) return EMPTY_LINKAGE;
  return null;
}

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

vi.mock("@/components/charts/ChartRenderer", () => ({
  ChartRenderer: ({ title }: { title?: string }) => <div data-testid="chart-mock">{title}</div>,
}));

function withDs(config: ReturnType<typeof defaultChartConfig>) {
  return {
    ...config,
    dataSourceId: DS_ID,
    mode: "sql" as const,
    sql: "SELECT 1 AS id",
  };
}

const sampleWidgets: LayoutWidget[] = [
  {
    id: "w1",
    type: "chart",
    title: "A",
    colSpan: 6,
    rowSpan: 1,
    order: 0,
    chartConfig: withDs(defaultChartConfig("table")),
  },
  {
    id: "w2",
    type: "chart",
    title: "B",
    colSpan: 6,
    rowSpan: 1,
    order: 1,
    chartConfig: withDs(defaultChartConfig("line")),
  },
  {
    id: "w3",
    type: "chart",
    title: "C",
    colSpan: 6,
    rowSpan: 1,
    order: 2,
    chartConfig: withDs(defaultChartConfig("bar")),
  },
];

function renderEditPage(path = "/admin/dashboards/d1/edit") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/admin/dashboards" element={<div>看板列表页</div>} />
            <Route path="/admin/dashboards/:id/edit" element={<DashboardEditPage mode="edit" />} />
            <Route path="/admin/dashboards/:id" element={<DashboardEditPage mode="view" />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

async function waitForEditPageName(name = "销售看板") {
  const field = await screen.findByTestId("dashboard-name-field");
  expect(field).toHaveTextContent(name);
  return field;
}

function DashboardRouteWithSwitch() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate("/admin/dashboards/d2/edit")}>
        切换看板
      </button>
      <DashboardEditPage mode="edit" />
    </>
  );
}

function mockDashboardLoad(widgets: LayoutWidget[]) {
  mockApiFetch.mockImplementation(async (...args: unknown[]) => {
    const path = String(args[0] ?? "");
    if (path === "/api/v1/datasources") return { items: [{ id: DS_ID, name: "分析库", code: "a" }] };
    if (path.includes("/api/v1/datasets")) return { items: [] };
    if (path.includes("/charts/types")) {
      return [
        { type: "table", displayName: "表格", styleVariants: ["default"], fieldRule: {} },
        { type: "line", displayName: "折线图", styleVariants: ["default"], fieldRule: {} },
        { type: "funnel", displayName: "漏斗图", styleVariants: ["default"], fieldRule: {} },
      ];
    }
    const filters = mockGlobalFiltersPath(path);
    if (filters) return filters;
    if (path.includes("/dashboards/")) {
      return { id: "d1", name: "销售看板", layoutJson: { version: 1, widgets, globalFilters: [] } };
    }
    return { columns: [], rows: [] };
  });
}

function renderListPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DashboardListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function clickWidgetByTitle(title: string, options?: { shiftKey?: boolean }) {
  const mocks = screen.getAllByTestId("chart-mock");
  const el = mocks.find((m) => m.textContent === title);
  if (!el) throw new Error(`chart mock ${title} not found`);
  const target = el.closest("[role='button']");
  if (!target) throw new Error("widget select target not found");
  fireEvent.click(target, options);
}

async function insertLineChartFromToolbar(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("palette-toolbar-toggle"));
  await user.click(await screen.findByRole("button", { name: "折线图" }));
}

async function beginWidgetTitleEdit(
  user: ReturnType<typeof userEvent.setup>,
  widgetId = "w1",
) {
  const titleEl =
    screen.queryByTestId(`pixel-shape-title-${widgetId}`) ??
    screen.queryByTestId(`widget-inline-title-${widgetId}`);
  if (!titleEl) throw new Error(`title target for ${widgetId} not found`);
  await user.click(titleEl);
  return screen.getByLabelText("组件标题");
}

describe("dashboard admin smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    resetChartTypeCatalogCache();
  });
  afterEach(() => {
    cleanup();
  });

  it("T-DASH-R28-002-01: empty edit grid shows drop zone guidance", () => {
    render(
      <DashboardGrid
        mode="edit"
        widgets={[]}
        onInsertChart={() => {}}
        onLayoutChange={() => {}}
        renderWidget={() => null}
      />,
    );
    expect(screen.getByText("画布是空的")).toBeInTheDocument();
    expect(document.querySelector(".dashboard-grid-edit .layout")).toBeTruthy();
  });

  it("T-DASH-R28-003-02: palette inserts chart type", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    render(
      <MemoryRouter>
        <WidgetPalette onInsert={onInsert} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "折线图" }));
    expect(onInsert).toHaveBeenCalledWith("line");
  });

  it("T-DASH-003-04: palette groups catalog by category", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValueOnce([
      { type: "table", displayName: "表格", category: "basic", renderer: "table", styleVariants: ["default"], fieldRule: {} },
      { type: "heatmap", displayName: "热力图", category: "geo", renderer: "antv", styleVariants: ["default"], fieldRule: {} },
    ]);
    const onInsert = vi.fn();
    render(
      <MemoryRouter>
        <WidgetPalette onInsert={onInsert} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("地理")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "热力图" }));
    expect(onInsert).toHaveBeenCalledWith("heatmap");
  });

  it("T-VIZ-PALETTE-03: palette fallback lists pie and gauge", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    render(
      <MemoryRouter>
        <WidgetPalette onInsert={onInsert} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "饼图" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "仪表盘" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "饼图" }));
    expect(onInsert).toHaveBeenCalledWith("pie");
  });

  it("T-DASH-PALETTE-01: chart toolbar opens DE-style categorized picker", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DashboardEditWorkspace
          onPaletteInsert={() => {}}
          canvas={<div data-testid="canvas-area">canvas</div>}
          chartRail={<div>rail</div>}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("图表")).toBeInTheDocument();
    expect(screen.queryByTestId("palette-dropdown-menu")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("palette-toolbar-toggle"));
    expect(await screen.findByTestId("palette-dropdown-menu")).toBeInTheDocument();
    expect(screen.getByTestId("chart-picker-popover")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "图表分类" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "指标" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "线/面图" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "线/面图" }));
    expect(screen.getByRole("button", { name: "基础折线图" })).toBeInTheDocument();
  });

  it("T-DASH-PALETTE-02: query filter picker inserts filter with control type", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    render(
      <MemoryRouter>
        <DashboardEditWorkspace
          onPaletteInsert={onInsert}
          canvas={<div>canvas</div>}
          chartRail={<div>rail</div>}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByTestId("toolbar-query-toggle"));
    expect(await screen.findByTestId("query-component-picker")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "下拉" }));
    expect(onInsert).toHaveBeenCalledWith({ type: "filter", controlType: "select" });
  });

  it("T-DASH-PALETTE-02b: createPaletteWidget respects filter controlType", () => {
    const widget = createPaletteWidget({ type: "filter", controlType: "date" }, []);
    expect(widget.type).toBe("filter");
    expect(widget.filterConfig?.controlType).toBe("date");
  });

  it("T-DASH-PALETTE-03: workspace has canvas edit toolbar without docked palette", () => {
    render(
      <MemoryRouter>
        <DashboardEditWorkspace
          onPaletteInsert={() => {}}
          canvas={<div data-testid="canvas-area">canvas</div>}
          chartRail={<div>rail</div>}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("canvas-edit-toolbar")).toBeInTheDocument();
    expect(screen.queryByTestId("palette-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("canvas-area")).toBeInTheDocument();
  });

  it("T-DASH-PALETTE-04: toolbar inserts text and media widgets", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    render(
      <MemoryRouter>
        <DashboardEditWorkspace
          onPaletteInsert={onInsert}
          canvas={<div>canvas</div>}
          chartRail={<div>rail</div>}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByTestId("toolbar-insert-text"));
    expect(onInsert).toHaveBeenCalledWith("text");
    await user.click(screen.getByTestId("toolbar-insert-media"));
    expect(onInsert).toHaveBeenCalledWith("media");
    await user.click(screen.getByTestId("toolbar-insert-tabs"));
    expect(onInsert).toHaveBeenCalledWith("tabs");
  });

  it("T-DASH-PALETTE-05: more menu opens dashboard style action", async () => {
    const user = userEvent.setup();
    const onStyle = vi.fn();
    render(
      <MemoryRouter>
        <DashboardEditWorkspace
          onPaletteInsert={() => {}}
          onOpenDashboardStyle={onStyle}
          canvas={<div>canvas</div>}
          chartRail={<div>rail</div>}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByTestId("toolbar-more-toggle"));
    expect(await screen.findByTestId("toolbar-more-menu")).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "仪表板样式" }));
    expect(onStyle).toHaveBeenCalled();
  });

  it("T-DASH-PALETTE-05b: more menu toggles auxiliary grid when wired", async () => {
    const user = userEvent.setup();
    const onAuxGrid = vi.fn();
    render(
      <MemoryRouter>
        <DashboardEditWorkspace
          onPaletteInsert={() => {}}
          showAuxiliaryGrid
          onAuxiliaryGridChange={onAuxGrid}
          canvas={<div>canvas</div>}
          chartRail={<div>rail</div>}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByTestId("toolbar-more-toggle"));
    expect(await screen.findByTestId("toolbar-auxiliary-grid-item")).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "辅助对齐网格" }));
    expect(onAuxGrid).toHaveBeenCalledWith(false);
  });

  it("T-DASH-PALETTE-06: createPaletteWidget builds text widget config", () => {
    const widget = createPaletteWidget("text", []);
    expect(widget.type).toBe("text");
    expect(widget.textConfig?.variant).toBe("html");
  });

  it("T-VIZ-FC-04: palette opens chart types catalog drawer", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <WidgetPalette onInsert={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: /查看全部类型与字段规则/ }));
    expect(await screen.findByText("图表类型目录")).toBeInTheDocument();
  });

  it("T-DASH-R28-003-03: delete widget from inspector only", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <WidgetInspectorDelete widgetTitle={sampleWidgets[1].title} onDelete={onDelete} />,
    );
    await user.click(screen.getByRole("button", { name: "删除组件" }));
    await user.click(screen.getByRole("button", { name: "删除" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("T-DASH-003-01: edit widget card has draggable title bar and header delete", () => {
    const onDelete = vi.fn();
    render(
      <DashboardWidget widget={sampleWidgets[0]} mode="edit" onDelete={onDelete} onTitleChange={() => {}} />,
    );
    expect(screen.getByLabelText("拖动以移动组件")).toHaveClass("dashboard-drag-handle");
    expect(screen.getByRole("button", { name: "删除组件" })).toBeInTheDocument();
  });

  it("F-A: edit mode with ready config renders live ChartRenderer, not preview-only text", () => {
    render(
      <DashboardWidget widget={sampleWidgets[0]} mode="edit" onTitleChange={() => {}} />,
    );
    expect(screen.getByTestId("chart-mock")).toBeInTheDocument();
    expect(screen.queryByText("保存布局后可在预览查看出图")).not.toBeInTheDocument();
  });

  it("F-A: edit mode with unready config still shows pending placeholder", () => {
    const widgetNoDs = {
      ...sampleWidgets[0],
      chartConfig: { ...defaultChartConfig("table"), dataSourceId: "" },
    };
    render(<DashboardWidget widget={widgetNoDs} mode="edit" onTitleChange={() => {}} />);
    expect(screen.queryByTestId("chart-mock")).not.toBeInTheDocument();
    expect(screen.getByText("待配置")).toBeInTheDocument();
  });

  it("T-DASH-R28-003-04: layoutUtils sortWidgets round-trip", () => {
    const shuffled = [sampleWidgets[2], sampleWidgets[0], sampleWidgets[1]];
    const sorted = sortWidgets(shuffled);
    expect(sorted.map((w) => w.id)).toEqual(["w1", "w2", "w3"]);
    const moved = moveWidget(sorted, "w2", "up");
    expect(sortWidgets(moved).map((w) => w.id)).toEqual(["w2", "w1", "w3"]);
  });

  it("T-DASH-002-01: gridLayoutAdapter round-trip order", () => {
    const layout = widgetsToGridLayout(sampleWidgets);
    const next = gridLayoutToWidgets(layout, sampleWidgets);
    expect(next.map((w) => w.id)).toEqual(["w1", "w2", "w3"]);
  });

  it("T-DASH-002-02: snapLayoutToGrid snaps width and x to 12-col slots", () => {
    const layout = widgetsToGridLayout(sampleWidgets);
    const shifted = layout.map((item, i) => (i === 0 ? { ...item, x: 4.2, w: 5.6 } : item));
    const snapped = snapLayoutToGrid(shifted);
    expect(snapped[0].x).toBe(6);
    expect(snapped[0].w).toBe(6);
  });

  it("T-DASH-002-04: shift+click toggles multi-select on edit page", async () => {
    mockDashboardLoad(sampleWidgets);
    renderEditPage();
    await waitForEditPageName();
    clickWidgetByTitle("A");
    clickWidgetByTitle("B", { shiftKey: true });
    await waitFor(
      () => {
        expect(screen.getByTestId("canvas-multi-select-hint")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /删除选中 \(2\)/ })).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("T-DASH-002-05: batch delete removes multi-selected widgets", async () => {
    const user = userEvent.setup();
    mockDashboardLoad(sampleWidgets);
    renderEditPage();
    await waitForEditPageName();
    clickWidgetByTitle("A");
    clickWidgetByTitle("B", { shiftKey: true });
    await user.click(await screen.findByRole("button", { name: /删除选中 \(2\)/ }));
    await user.click(screen.getByRole("button", { name: "删除" }));
    expect(await screen.findAllByTestId("chart-mock")).toHaveLength(1);
  });

  it("T-DASH-004-02: linkage rules panel saves via PUT global-filters", async () => {
    const user = userEvent.setup();
    let putBody: Record<string, unknown> | undefined;
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === "/api/v1/datasources") return { items: [{ id: DS_ID, name: "分析库", code: "a" }] };
      if (path.includes("/global-filters") && init?.method === "PUT") {
        putBody = JSON.parse(init.body as string);
        return {
          filters: putBody?.filters,
          linkageRules: putBody?.linkageRules,
          refreshMode: "eager",
          affectedWidgetCount: 1,
        };
      }
      if (path.includes("/global-filters")) {
        return {
          filters: [{ filterId: "f1", dimensionRef: "区域", defaultValue: "华东" }],
          linkageRules: [],
        };
      }
      if (path.includes("/dashboards/")) {
        return { id: "d1", name: "销售看板", layoutJson: { version: 1, widgets: sampleWidgets, globalFilters: [] } };
      }
      return {};
    });
    render(
      <LinkageRulesPanel
        dashboardId="d1"
        linkage={{
          filters: [{ filterId: "f1", dimensionRef: "区域", defaultValue: "华东" }],
          linkageRules: [],
        }}
        widgets={sampleWidgets}
        onSaved={() => {}}
      />,
    );
    await user.click(screen.getByLabelText("源筛选器"));
    await user.click(await screen.findByRole("option", { name: "区域" }));
    await user.type(screen.getByLabelText("参数键 parameterKey"), "region");
    await user.click(screen.getByRole("checkbox", { name: "A" }));
    await user.click(screen.getByRole("button", { name: "添加规则" }));
    await user.click(screen.getByRole("button", { name: "保存联动" }));
    expect(putBody?.linkageRules).toEqual([
      { sourceFilterId: "f1", targetWidgetIds: ["w1"], parameterKey: "region" },
    ]);
  });

  it("T-DASH-004-03: edit page shows linkage section when global-filters has entries", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path === "/api/v1/datasources") return { items: [{ id: DS_ID, name: "分析库", code: "a" }] };
      if (path.includes("/global-filters")) {
        return {
          filters: [{ filterId: "f1", dimensionRef: "区域", defaultValue: "华东" }],
          linkageRules: [],
        };
      }
      if (path.includes("/dashboards/")) {
        return { id: "d1", name: "销售看板", layoutJson: { version: 1, widgets: sampleWidgets.slice(0, 1), globalFilters: [] } };
      }
      return {};
    });
    renderEditPage();
    expect(await screen.findByTestId("dashboard-name-field")).toHaveTextContent("销售看板");
    expect(await screen.findByTestId("dashboard-linkage-section")).toBeInTheDocument();
    expect(screen.getByText("筛选联动")).toBeInTheDocument();
  });

  it("T-DASH-002-03: normalizeWidgetLayout unpacks overlapping widgets", () => {
    const a = { ...sampleWidgets[0], gridX: 0, gridY: 0, colSpan: 12, rowSpan: 3 };
    const b = { ...sampleWidgets[1], id: "w-overlap", gridX: 0, gridY: 0, colSpan: 12, rowSpan: 3, order: 1 };
    const normalized = normalizeWidgetLayout([a, b]);
    const layout = widgetsToGridLayout(normalized);
    const collides = (x: number, y: number, w: number, h: number, ox: number, oy: number, ow: number, oh: number) =>
      !(x + w <= ox || ox + ow <= x || y + h <= oy || oy + oh <= y);
    expect(collides(layout[0].x, layout[0].y, layout[0].w, layout[0].h, layout[1].x, layout[1].y, layout[1].w, layout[1].h)).toBe(false);
    expect(layout[1].y).toBeGreaterThanOrEqual(layout[0].y + layout[0].h);
  });

  it("T-DASH-R28-002-02: list page empty state", async () => {
    mockApiFetch.mockResolvedValueOnce({ items: [], total: 0, limit: 50, offset: 0 });
    renderListPage();
    expect(await screen.findByText("暂无仪表板")).toBeInTheDocument();
  });

  it("T-DASH-R28-002-03: edit page loads layout", async () => {
    const user = userEvent.setup();
    mockDashboardLoad(sampleWidgets.slice(0, 1));
    renderEditPage();
    expect(await screen.findByTestId("dashboard-name-field")).toHaveTextContent("销售看板");
    expect(await screen.findByTestId("widget-inline-title-w1")).toHaveTextContent("A");
    const titleInput = await beginWidgetTitleEdit(user);
    expect(titleInput).toHaveValue("A");
  });

  it("T-DASH-DE-DRAFT-01: save layout succeeds with unconfigured chart widgets", async () => {
    const user = userEvent.setup();
    const draftWidget: LayoutWidget = {
      id: "w-draft",
      type: "chart",
      title: "表格",
      colSpan: 6,
      rowSpan: 2,
      order: 0,
      chartConfig: {
        chartType: "table",
        chartId: "w-draft",
        mode: "dataset",
        dataSourceId: "",
        dimensions: [],
        metrics: [],
      },
    };
    let layoutPut = 0;
    let globalFiltersPut = 0;
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === "/api/v1/datasources") return { items: [{ id: DS_ID, name: "分析库", code: "a" }] };
      const filters = mockGlobalFiltersPath(path);
      if (filters) return filters;
      if (path.includes("/layout") && init?.method === "PUT") {
        layoutPut += 1;
        return {};
      }
      if (path.includes("/global-filters") && init?.method === "PUT") {
        globalFiltersPut += 1;
        throw Object.assign(new Error("At least one filter is required"), {
          code: "DASH_FILTER_EMPTY_FILTERS",
        });
      }
      if (path.includes("/dashboards/")) {
        return {
          id: "d1",
          name: "草稿看板",
          layoutJson: { version: 1, widgets: [draftWidget], globalFilters: [] },
        };
      }
      return {};
    });
    renderEditPage();
    await screen.findByDisplayValue("草稿看板");
    await insertLineChartFromToolbar(user);
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(layoutPut).toBeGreaterThanOrEqual(1);
    });
    expect(globalFiltersPut).toBe(0);
    expect(screen.queryByText(/Invalid chart config/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/At least one filter is required/i)).not.toBeInTheDocument();
  });

  it("T-DASH-R29-002-04: view mode uses react-grid-layout for positioned widgets", () => {
    const widget = { ...sampleWidgets[0], colSpan: 12, gridX: 0, gridY: 0 };
    const { container } = render(
      <DashboardGrid mode="view" widgets={[widget]} renderWidget={() => <div data-testid="w" />} />,
    );
    expect(container.querySelector(".dashboard-grid-view .react-grid-item")).toBeTruthy();
    expect(screen.getByTestId("w")).toBeInTheDocument();
  });

  it("T-DASH-R29-002-05: illegal layout save shows Chinese error banner", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === "/api/v1/datasources") return { items: [{ id: DS_ID, name: "分析库", code: "a" }] };
      const filters = mockGlobalFiltersPath(path);
      if (filters) return filters;
      if (path.includes("/layout") && init?.method === "PUT") {
        throw Object.assign(new Error("组件 ID 重复"), { code: "DASH_DUPLICATE_WIDGET" });
      }
      if (path.includes("/global-filters") && init?.method === "PUT") {
        return { filters: [], linkageRules: [], refreshMode: "eager" };
      }
      return {
        id: "d1",
        name: "X",
        layoutJson: { version: 1, widgets: sampleWidgets.slice(0, 1), globalFilters: [] },
      };
    });
    renderEditPage();
    await screen.findByDisplayValue("X");
    const titleInput = await beginWidgetTitleEdit(user);
    await user.type(titleInput, "!");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("组件 ID 重复")).toBeInTheDocument();
  });

  it("T-DASH-R29-003-01: title change reflected in save payload", async () => {
    const user = userEvent.setup();
    let putBody: { layoutJson?: { widgets?: { title: string }[] } } | undefined;
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === "/api/v1/datasources") return { items: [{ id: DS_ID, name: "分析库", code: "a" }] };
      const filters = mockGlobalFiltersPath(path);
      if (filters) return filters;
      if (init?.method === "PUT") {
        putBody = JSON.parse(init.body as string);
        return { layoutJson: putBody?.layoutJson };
      }
      return {
        id: "d1",
        name: "编辑",
        layoutJson: { version: 1, widgets: sampleWidgets.slice(0, 1), globalFilters: [] },
      };
    });
    renderEditPage();
    const titleInput = await beginWidgetTitleEdit(user);
    await user.clear(titleInput);
    await user.type(titleInput, "新标题");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(putBody?.layoutJson?.widgets?.[0]?.title).toBe("新标题");
  });

  it("T-DASH-002-06: saving a legacy flow layout serializes grid coordinates", async () => {
    const user = userEvent.setup();
    let layoutPut: { layoutJson?: { widgets?: Array<{ gridX?: number; gridY?: number }> } } | undefined;
    const legacyWidgets = sampleWidgets.slice(0, 2).map(({ gridX: _gridX, gridY: _gridY, ...widget }) => widget);
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === "/api/v1/datasources") return { items: [{ id: DS_ID, name: "分析库", code: "a" }] };
      const filters = mockGlobalFiltersPath(path);
      if (filters) return filters;
      if (path.includes("/layout") && init?.method === "PUT") {
        layoutPut = JSON.parse(init.body as string);
        return {};
      }
      if (path.includes("/dashboards/")) {
        return {
          id: "d1",
          name: "兼容布局",
          layoutJson: { version: 1, widgets: legacyWidgets, globalFilters: [] },
        };
      }
      return {};
    });
    renderEditPage();
    await screen.findByTestId("widget-inline-title-w1");
    const titleInput = await beginWidgetTitleEdit(user, "w1");
    await user.type(titleInput, "!");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(layoutPut?.layoutJson?.widgets).toEqual([
        expect.objectContaining({ gridX: 0, gridY: 0 }),
        expect.objectContaining({ gridX: 6, gridY: 0 }),
      ]);
    });
  });

  it("T-VIZ-002-01: save layout persists chart sql binding from loaded config", async () => {
    const user = userEvent.setup();
    let putBody: {
      layoutJson?: { widgets?: { chartConfig?: { dataSourceId?: string; sql?: string } }[] };
    } | undefined;
    const widgetWithSql = {
      ...sampleWidgets[0],
      chartConfig: {
        ...defaultChartConfig("table"),
        mode: "sql" as const,
        dataSourceId: DS_ID,
        sql: "SELECT 2 AS id",
      },
    };
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === "/api/v1/datasources") return { items: [{ id: DS_ID, name: "分析库", code: "a" }] };
      const filters = mockGlobalFiltersPath(path);
      if (filters) return filters;
      if (init?.method === "PUT") {
        putBody = JSON.parse(init.body as string);
        return {};
      }
      return {
        id: "d1",
        name: "编辑",
        layoutJson: { version: 1, widgets: [widgetWithSql], globalFilters: [] },
      };
    });
    renderEditPage();
    const titleInput = await beginWidgetTitleEdit(user);
    await user.type(titleInput, "!");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(putBody?.layoutJson?.widgets?.[0]?.chartConfig?.dataSourceId).toBe(DS_ID);
    expect(putBody?.layoutJson?.widgets?.[0]?.chartConfig?.sql).toBe("SELECT 2 AS id");
  });

  it("T-DASH-R29-003-02: empty edit grid shows drag hint", () => {
    render(
      <DashboardGrid
        mode="edit"
        widgets={[]}
        onInsertChart={() => {}}
        onLayoutChange={() => {}}
        renderWidget={() => null}
      />,
    );
    expect(screen.getByText("画布是空的")).toBeInTheDocument();
    expect(screen.getByText(/从左侧拖拽或点击图表类型/)).toBeInTheDocument();
  });

  it("T-DASH-004-01: palette row sets chart drag payload", () => {
    const store = new Map<string, string>();
    const dt = {
      get types() {
        return [...store.keys()];
      },
      setData(type: string, value: string) {
        store.set(type, value);
      },
      getData(type: string) {
        return store.get(type) ?? "";
      },
      effectAllowed: "",
    } as unknown as DataTransfer;
    setChartTypeDragData(dt, "table");
    expect(dt.types).toContain(DASHBOARD_CHART_DND_TYPE);
    expect(dt.getData(DASHBOARD_CHART_DND_TYPE)).toBe("table");
  });

  it("T-DASH-R29-003-05: delete middle widget reorders without error", () => {
    const remaining = sampleWidgets.filter((w) => w.id !== "w2");
    const sorted = sortWidgets(remaining);
    expect(sorted.map((w) => w.id)).toEqual(["w1", "w3"]);
  });

  it("T-DASH-DELETE-01: delete dashboard navigates to list (no zombie edit)", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === "/api/v1/datasources") return { items: [] };
      const filters = mockGlobalFiltersPath(path);
      if (filters) return filters;
      if (init?.method === "DELETE") return undefined;
      return {
        id: "d1",
        name: "待删看板",
        layoutJson: { version: 1, widgets: sampleWidgets.slice(0, 1), globalFilters: [] },
      };
    });
    renderEditPage();
    expect(await screen.findByText("待删看板")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "删除看板" }));
    await user.click(screen.getByRole("button", { name: "删除" }));
    expect(await screen.findByText("看板列表页")).toBeInTheDocument();
  });

  it("T-DASH-DELETE-02: missing dashboard shows empty state instead of zombie canvas", async () => {
    mockApiFetch.mockImplementation(async () => {
      throw new ApiRequestError("Dashboard not found", "DASH_NOT_FOUND");
    });
    renderEditPage();
    expect(await screen.findByText("看板不存在或已被删除")).toBeInTheDocument();
    expect(screen.queryByText("画布")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回看板列表" })).toBeInTheDocument();
  });

  it("T-DASH-R29-001-05: list page renders paginated row count", async () => {
    mockApiFetch.mockResolvedValueOnce({
      items: [
        { id: "1", name: "A", slug: "a", updatedAt: "2026-01-01" },
        { id: "2", name: "B", slug: "b", updatedAt: "2026-01-02" },
      ],
      total: 5,
      limit: 2,
      offset: 0,
    });
    renderListPage();
    expect(await screen.findByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.queryByText("C")).not.toBeInTheDocument();
  });

  it("T-DASH-RICH-01: inline text commit marks layout dirty and is saved", async () => {
    const user = userEvent.setup();
    mockDashboardLoad([
      {
        id: "text-1",
        type: "text",
        title: "说明",
        colSpan: 6,
        rowSpan: 2,
        order: 0,
        textConfig: { content: "<p>旧内容</p>", variant: "html" },
      },
    ]);
    renderEditPage();
    const content = await screen.findByTestId("text-widget-content");
    await user.dblClick(content);
    await screen.findByRole("textbox", { name: "富文本内容" });
    await user.keyboard("新增");
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
  });

  it("F-C: step back restores previous widget layout after adding widget", async () => {
    const user = userEvent.setup();
    mockDashboardLoad(sampleWidgets.slice(0, 1));
    renderEditPage();
    await screen.findByTestId("widget-inline-title-w1");
    expect(screen.getAllByTestId("chart-mock")).toHaveLength(1);
    await insertLineChartFromToolbar(user);
    expect(await screen.findAllByTestId("chart-mock")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "上一步" }));
    expect(screen.getAllByTestId("chart-mock")).toHaveLength(1);
  });

  it("F-C-02: step forward reapplies layout after step back", async () => {
    const user = userEvent.setup();
    mockDashboardLoad(sampleWidgets.slice(0, 1));
    renderEditPage();
    await screen.findByTestId("widget-inline-title-w1");
    await insertLineChartFromToolbar(user);
    expect(await screen.findAllByTestId("chart-mock")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "上一步" }));
    expect(screen.getAllByTestId("chart-mock")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(screen.getAllByTestId("chart-mock")).toHaveLength(2);
  });

  it("F-D: edit mode loads global filters and shows linkage config in dashboard rail", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path === "/api/v1/datasources") return { items: [{ id: DS_ID, name: "分析库", code: "a" }] };
      if (path.includes("/global-filters")) {
        return {
          filters: [{ filterId: "f1", dimensionRef: "区域", defaultValue: "华东" }],
          linkageRules: [],
        };
      }
      if (path.includes("/dashboards/")) {
        return { id: "d1", name: "销售看板", layoutJson: { version: 1, widgets: sampleWidgets.slice(0, 1), globalFilters: [] } };
      }
      return {};
    });
    renderEditPage();
    await waitForEditPageName();
    expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/dashboards/d1/global-filters");
    expect(screen.queryByLabelText("区域")).not.toBeInTheDocument();
    expect(screen.getByTestId("dashboard-linkage-section")).toBeInTheDocument();
  });

  it("B3: pixel on + v1 migrates in memory and first save writes complete v2 layout", async () => {
    const user = userEvent.setup();
    let layoutPut: { layoutJson?: { version?: number; canvas?: unknown; widgets?: unknown[] } } | undefined;
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      const filters = mockGlobalFiltersPath(path);
      if (filters) return filters;
      if (path.includes("/layout") && init?.method === "PUT") {
        layoutPut = JSON.parse(init.body as string);
        return {};
      }
      return {
        id: "d1",
        name: "像素迁移",
        layoutJson: {
          version: 1,
          widgets: sampleWidgets.slice(0, 1),
          globalFilters: [{ id: "region" }],
        },
      };
    });

    renderEditPage();
    expect(await screen.findByTestId("pixel-canvas-host")).toBeInTheDocument();
    const title = await beginWidgetTitleEdit(user, "w1");
    await user.type(title, "!");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(layoutPut?.layoutJson?.version).toBe(2));
    expect(layoutPut?.layoutJson?.canvas).toEqual({ width: 1440, height: 900 });
    expect((layoutPut?.layoutJson as { globalFilters?: unknown[] })?.globalFilters).toEqual([
      { id: "region" },
    ]);
    expect(layoutPut?.layoutJson?.widgets?.[0]).toEqual(
      expect.objectContaining({ x: 0, y: 0, width: 720, height: 76 }),
    );
  });

  it("B3: v2 layout stays editable with pixel canvas fixed on", async () => {
    const pixelWidget = {
      ...sampleWidgets[0],
      x: 120,
      y: 80,
      width: 480,
      height: 320,
    };
    const {
      colSpan: _colSpan,
      rowSpan: _rowSpan,
      gridX: _gridX,
      gridY: _gridY,
      ...v2Widget
    } = pixelWidget;
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const filters = mockGlobalFiltersPath(String(args[0] ?? ""));
      if (filters) return filters;
      return {
        id: "d1",
        name: "像素编辑",
        layoutJson: {
          version: 2,
          canvas: { width: 1440, height: 900 },
          widgets: [v2Widget],
          globalFilters: [],
        },
      };
    });

    renderEditPage();
    expect(await screen.findByTestId("pixel-canvas-host")).toBeInTheDocument();
    expect(screen.queryByText(/像素布局只读/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
    expect(screen.getByTestId("pixel-drag-edge-top-w1")).toBeInTheDocument();
    expect(screen.getByTestId("palette-toolbar-toggle")).toBeInTheDocument();
  });

  it("B3: v1 migrates to pixel canvas on load", async () => {
    mockDashboardLoad(sampleWidgets.slice(0, 1));
    renderEditPage();
    expect(await screen.findByTestId("pixel-canvas-host")).toBeInTheDocument();
    expect(screen.getByTestId("palette-toolbar-toggle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除看板" })).toBeInTheDocument();
  });

  it("B3: ignores a stale dashboard response after the route id changes", async () => {
    let resolveFirst!: (detail: unknown) => void;
    const first = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path.includes("/global-filters")) return EMPTY_LINKAGE;
      if (path === "/api/v1/dashboards/d1") return first;
      if (path === "/api/v1/dashboards/d2") {
        return {
          id: "d2",
          name: "第二个看板",
          layoutJson: { version: 1, widgets: [], globalFilters: [] },
        };
      }
      return {};
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/admin/dashboards/d1/edit"]}>
          <Routes>
            <Route path="/admin/dashboards/:id/edit" element={<DashboardRouteWithSwitch />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/dashboards/d1"),
    );
    await user.click(screen.getByRole("button", { name: "切换看板" }));
    expect(await screen.findByDisplayValue("第二个看板")).toBeInTheDocument();
    resolveFirst({
      id: "d1",
      name: "过期看板",
      layoutJson: { version: 1, widgets: sampleWidgets, globalFilters: [] },
    });
    await waitFor(() =>
      expect(screen.getByDisplayValue("第二个看板")).toBeInTheDocument(),
    );
    expect(screen.queryByDisplayValue("过期看板")).not.toBeInTheDocument();
  });

  it("B3: pixel on + v2 edits and saves without changing pixel geometry", async () => {
    const user = userEvent.setup();
    const { colSpan: _colSpan, rowSpan: _rowSpan, ...base } = sampleWidgets[0];
    let saved: { layoutJson?: { version?: number; widgets?: Array<Record<string, unknown>> } } | undefined;
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      const filters = mockGlobalFiltersPath(path);
      if (filters) return filters;
      if (path.includes("/layout") && init?.method === "PUT") {
        saved = JSON.parse(init.body as string);
        return {};
      }
      return {
        id: "d1",
        name: "原生像素",
        layoutJson: {
          version: 2,
          canvas: { width: 1440, height: 900 },
          widgets: [{ ...base, x: 123, y: 87, width: 480, height: 320 }],
          globalFilters: [],
        },
      };
    });

    renderEditPage();
    const title = await beginWidgetTitleEdit(user, "w1");
    await user.type(title, "!");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(saved?.layoutJson?.version).toBe(2));
    expect(saved?.layoutJson?.widgets?.[0]).toEqual(
      expect.objectContaining({ x: 123, y: 87, width: 480, height: 320 }),
    );
    expect(saved?.layoutJson?.widgets?.[0]).not.toHaveProperty("colSpan");
  });

  it("B3: v2 save preserves widget array order and order while normalizing overlaps", async () => {
    const user = userEvent.setup();
    const { colSpan: _colSpan, rowSpan: _rowSpan, ...base } = sampleWidgets[0];
    let saved: { layoutJson?: { widgets?: Array<Record<string, unknown>> } } | undefined;
    const overlapping = [
      { ...base, id: "top", title: "Top", order: 9, x: 100, y: 100, width: 480, height: 320 },
      { ...base, id: "bottom", title: "Bottom", order: 2, x: 100, y: 100, width: 480, height: 320 },
    ];
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      const filters = mockGlobalFiltersPath(path);
      if (filters) return filters;
      if (path.includes("/layout") && init?.method === "PUT") {
        saved = JSON.parse(init.body as string);
        return {};
      }
      return {
        id: "d1",
        name: "重叠像素",
        layoutJson: {
          version: 2,
          canvas: { width: 1440, height: 900 },
          widgets: overlapping,
          globalFilters: [],
        },
      };
    });
    renderEditPage();
    const title = await beginWidgetTitleEdit(user, "top");
    await user.type(title, "!");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(saved).toBeDefined());
    expect(saved?.layoutJson?.widgets?.map((widget) => widget.id)).toEqual(["top", "bottom"]);
    expect(saved?.layoutJson?.widgets?.map((widget) => widget.order)).toEqual([9, 2]);
    expect(saved?.layoutJson?.widgets?.map(({ x, y, width, height }) => ({ x, y, width, height })))
      .toEqual([
        { x: 100, y: 432, width: 480, height: 320 },
        { x: 100, y: 100, width: 480, height: 320 },
      ]);
  });

  it("B3: pixel edit page exposes DE chrome and marks widget content non-draggable", async () => {
    mockDashboardLoad(sampleWidgets.slice(0, 1));
    renderEditPage();
    const content = await screen.findByTestId("chart-mock");
    expect(content.closest("[data-pixel-no-drag]")).toBeTruthy();
    fireEvent.pointerDown(content);
    expect(await screen.findByTestId("pixel-drag-edge-top-w1")).toBeInTheDocument();
    expect(screen.getByLabelText("拖动组件")).toBeInTheDocument();
    expect(screen.getByLabelText("调整组件大小：右下")).toBeInTheDocument();
  });

  it("B3: inserts a new v2 widget inside the scrolled visible viewport", async () => {
    const user = userEvent.setup();
    mockDashboardLoad([]);
    renderEditPage();
    const host = await screen.findByTestId("pixel-canvas-host");
    Object.defineProperties(host, {
      clientWidth: { configurable: true, value: 800 },
      clientHeight: { configurable: true, value: 500 },
      scrollLeft: { configurable: true, writable: true, value: 272 },
      scrollTop: { configurable: true, writable: true, value: 100 },
    });
    fireEvent.scroll(host);
    await insertLineChartFromToolbar(user);

    const shape = document.querySelector<HTMLElement>("[data-testid^='pixel-shape-']");
    expect(shape).toHaveStyle({ left: "360px", top: "190px" });
  });

  it("B3: selecting a pixel chart opens chart rail without ChartInspector crash", async () => {
    const { colSpan: _colSpan, rowSpan: _rowSpan, ...base } = sampleWidgets[1];
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path === "/api/v1/datasources") return { items: [{ id: DS_ID, name: "分析库", code: "a" }] };
      if (path.includes("/api/v1/datasets")) return { items: [] };
      if (path.includes("/charts/types")) {
        return [{ type: "line", displayName: "折线图", styleVariants: ["default"], fieldRule: {} }];
      }
      const filters = mockGlobalFiltersPath(path);
      if (filters) return filters;
      if (path.includes("/dashboards/")) {
        return {
          id: "d1",
          name: "销售看板",
          layoutJson: {
            version: 2,
            canvas: { width: 1440, height: 900 },
            widgets: [{ ...base, x: 100, y: 80, width: 480, height: 320 }],
            globalFilters: [],
          },
        };
      }
      return { columns: [], rows: [] };
    });
    renderEditPage();
    const shape = await screen.findByTestId("pixel-shape-w2");
    const inner = shape.querySelector("[data-pixel-no-drag]");
    expect(inner).toBeTruthy();
    fireEvent.pointerDown(inner!, { button: 0 });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "数据" })).toBeInTheDocument();
    });
    expect(screen.queryByText(/useChartInspector must be used/)).not.toBeInTheDocument();
  });

  it("B3: deletes a v2 widget without converting the layout", async () => {
    const user = userEvent.setup();
    mockDashboardLoad(sampleWidgets.slice(0, 1));
    renderEditPage();
    await screen.findByTestId("pixel-shape-w1");
    await user.click(screen.getByRole("button", { name: "删除组件" }));
    await user.click(screen.getByRole("button", { name: "删除" }));
    expect(screen.queryByTestId("pixel-shape-w1")).not.toBeInTheDocument();
    expect(screen.getByTestId("pixel-canvas-host")).toBeInTheDocument();
  });

  it("B3: preview chooses the read-only pixel engine for v2", async () => {
    const { colSpan: _colSpan, rowSpan: _rowSpan, ...base } = sampleWidgets[0];
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const filters = mockGlobalFiltersPath(String(args[0] ?? ""));
      if (filters) return filters;
      return {
        id: "d1",
        name: "像素预览",
        layoutJson: {
          version: 2,
          canvas: { width: 1440, height: 900 },
          widgets: [{ ...base, x: 0, y: 0, width: 720, height: 320 }],
          globalFilters: [],
        },
      };
    });

    renderEditPage("/admin/dashboards/d1");
    expect(await screen.findByTestId("pixel-canvas-host")).toBeInTheDocument();
    expect(screen.queryByTestId("pixel-drag-edge-top-w1")).not.toBeInTheDocument();
    expect(document.querySelector(".dashboard-grid-view")).toBeNull();
  });
});
