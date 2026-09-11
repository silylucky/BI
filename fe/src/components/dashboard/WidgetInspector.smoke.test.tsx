import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WidgetInspector } from "@/components/dashboard/WidgetInspector";
import { defaultChartConfig, type LayoutWidget } from "@/components/dashboard/layoutUtils";

const mockApiFetch = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

const widget: LayoutWidget = {
  id: "w1",
  type: "chart",
  title: "图表 A",
  colSpan: 6,
  rowSpan: 1,
  order: 0,
  chartConfig: {
    ...defaultChartConfig("line"),
    chartId: "w1",
    mode: "dataset",
    dataSourceId: "ds-1",
  },
};

function renderInspector() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onChange = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <WidgetInspector widget={widget} onChange={onChange} embedded />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onChange;
}

describe("WidgetInspector dataset select", () => {
  afterEach(() => {
    cleanup();
    mockApiFetch.mockReset();
  });

  it("shows empty dataset option when no datasets exist", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/datasources") {
        return { items: [{ id: "ds-1", name: "分析库", code: "a" }] };
      }
      if (path.includes("/api/v1/datasets")) return { items: [], total: 0 };
      return {};
    });

    const user = userEvent.setup();
    renderInspector();

    const trigger = await screen.findByRole("button", { name: "选择数据集" });
    await user.click(trigger);
    expect(await screen.findByText("暂无数据集")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "新建数据集" })).toHaveAttribute(
      "href",
      "/admin/datasets",
    );
  });

  it("deletes widget from inspector panel", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/datasources") {
        return { items: [{ id: "ds-1", name: "分析库", code: "a" }] };
      }
      if (path.includes("/api/v1/datasets")) return { items: [], total: 0 };
      return {};
    });

    const user = userEvent.setup();
    const onDelete = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <WidgetInspector widget={widget} onChange={vi.fn()} onDelete={onDelete} embedded />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole("button", { name: "删除组件" }));
    await user.click(screen.getByRole("button", { name: "删除" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("F-B: embeds ChartConfigPanel style/field controls in inspector tabs", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/datasources") {
        return { items: [{ id: "ds-1", name: "分析库", code: "a" }] };
      }
      if (path.includes("/api/v1/datasets")) return { items: [], total: 0 };
      if (path === "/api/v1/charts/types") {
        return [{ type: "line", displayName: "折线图", category: "basic", renderer: "antv", styleVariants: ["default"], fieldRule: {} }];
      }
      return {};
    });

    renderInspector();

    expect(await screen.findByText("类别轴 / 维度")).toBeInTheDocument();
    expect(screen.getByText("子类别 / 维度")).toBeInTheDocument();
    expect(screen.getByText("值轴 / 指标")).toBeInTheDocument();
    expect(screen.getByText("钻取 / 维度")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更新图表数据" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "样式" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "高级" })).toBeInTheDocument();
    expect(screen.getByText("字段")).toBeInTheDocument();
    expect(screen.getByText("维度")).toBeInTheDocument();
    expect(screen.getByText("指标")).toBeInTheDocument();
  });

  it("F-B: ChartConfigPanel edits flow through WidgetInspector onChange", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/datasources") {
        return { items: [{ id: "ds-1", name: "分析库", code: "a" }] };
      }
      if (path.includes("/api/v1/datasets")) return { items: [], total: 0 };
      if (path === "/api/v1/charts/types") return [];
      return {};
    });

    const user = userEvent.setup();
    const onChange = renderInspector();
    await screen.findByText("类别轴 / 维度");
    await user.click(screen.getByRole("button", { name: "添加筛选" }));

    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)?.[0];
    expect(last.filters?.length).toBe(1);
    expect(last.chartType).toBe(widget.chartConfig.chartType);
  });

  it("loads execute columns when dataset config is ready", async () => {
    const readyWidget: LayoutWidget = {
      ...widget,
      chartConfig: {
        ...widget.chartConfig,
        mode: "dataset",
        dataSourceId: "ds-1",
        datasetId: "orders_ds",
        configId: "cfg-11111111-1111-4111-8111-111111111111",
      },
    };

    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/v1/datasources") {
        return { items: [{ id: "ds-1", name: "分析库", code: "a" }] };
      }
      if (path.includes("/api/v1/datasets")) {
        return {
          items: [
            {
              datasetId: "orders_ds",
              displayName: "订单",
              boundConfigId: "cfg-11111111-1111-4111-8111-111111111111",
            },
          ],
        };
      }
      if (path === "/api/v1/query/dataset/execute" && init?.method === "POST") {
        return { columns: ["region", "amount"], rows: [] };
      }
      return {};
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <WidgetInspector widget={readyWidget} onChange={vi.fn()} embedded />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/v1/query/dataset/execute",
        expect.objectContaining({ method: "POST" }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByText(/在「高级」中绑定 Dataset 或 SQL 后/)).not.toBeInTheDocument();
    });
  });

  it("auto-fills dataSourceId when selecting bound dataset", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/datasources") {
        return { items: [{ id: "ds-1", name: "分析库", code: "a" }] };
      }
      if (path.includes("/api/v1/datasets")) {
        return {
          items: [
            {
              datasetId: "orders_ds",
              displayName: "订单",
              boundConfigId: "cfg-11111111-1111-4111-8111-111111111111",
            },
          ],
        };
      }
      if (path === "/api/v1/query/configs/cfg-11111111-1111-4111-8111-111111111111") {
        return {
          id: "cfg-11111111-1111-4111-8111-111111111111",
          configType: "dataset_query",
          payload: { dataSourceId: "ds-1" },
        };
      }
      return {};
    });

    const user = userEvent.setup();
    const onChange = renderInspector();
    const trigger = await screen.findByRole("button", { name: "选择数据集" });
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: "订单" }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      const last = onChange.mock.calls.at(-1)?.[0];
      expect(last.datasetId).toBe("orders_ds");
      expect(last.configId).toBe("cfg-11111111-1111-4111-8111-111111111111");
      expect(last.dataSourceId).toBe("ds-1");
    });
  });
});
