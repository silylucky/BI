import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartExploreContent } from "@/components/dashboard/ChartExploreContent";
import {
  ChartExploreCatalogTrigger,
  ChartExploreDrawer,
} from "@/components/dashboard/ChartExploreDrawer";
import { formatFieldSlotCount } from "@/pages/admin/charts/chartExplorePanels";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(async () => [
    {
      type: "line",
      displayName: "折线图",
      category: "basic",
      paletteCategory: "trend",
      renderer: "antv",
      styleVariants: ["default", "area"],
      capabilities: ["style_variant", "field_config"],
      fieldRule: { minDimensions: 1, maxDimensions: 2, minMetrics: 1, maxMetrics: 4 },
    },
    {
      type: "bar",
      displayName: "柱状图",
      category: "basic",
      paletteCategory: "compare",
      renderer: "antv",
      styleVariants: ["default"],
      capabilities: ["style_variant"],
      fieldRule: { minDimensions: 1, maxDimensions: 2, minMetrics: 1, maxMetrics: 4 },
    },
    {
      type: "gauge",
      displayName: "仪表盘",
      category: "indicator",
      paletteCategory: "quota",
      renderer: "antv",
      styleVariants: ["default", "progress"],
      capabilities: ["style_variant", "field_config", "render_spec"],
      fieldRule: { minDimensions: 0, maxDimensions: 0, minMetrics: 1, maxMetrics: 1 },
    },
  ]),
}));

function renderContent() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ChartExploreContent embedded />
    </QueryClientProvider>,
  );
}

function DrawerHarness() {
  const [open, setOpen] = useState(false);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <ChartExploreCatalogTrigger onOpen={() => setOpen(true)} />
      <ChartExploreDrawer open={open} onOpenChange={setOpen} />
    </QueryClientProvider>
  );
}

describe("formatFieldSlotCount", () => {
  it("shows 无 when min and max are both zero", () => {
    expect(formatFieldSlotCount(0, 0)).toBe("无");
  });

  it("shows single count when min equals max", () => {
    expect(formatFieldSlotCount(1, 1)).toBe("1 个");
  });
});

describe("ChartExploreContent", () => {
  afterEach(() => cleanup());

  it("does not show governance honesty banner", async () => {
    renderContent();
    expect(screen.queryByTestId("gov-honesty-banner")).not.toBeInTheDocument();
  });

  it("renders read-only hint aligned with picker", async () => {
    renderContent();
    expect(screen.getByText(/本目录为只读参考，与编辑态组件库分区一致/)).toBeInTheDocument();
  });

  it("loads chart types into detail panel", async () => {
    renderContent();
    expect(await screen.findByRole("heading", { name: "折线图" })).toBeInTheDocument();
    expect(screen.getByText("line")).toBeInTheDocument();
  });

  it("shows DE palette section count instead of legacy category count", async () => {
    renderContent();
    await screen.findByRole("heading", { name: "折线图" });
    const stats = screen.getByText("注册渲染器").closest("div.flex.flex-wrap");
    expect(stats?.textContent).toMatch(/组件分区/);
    expect(stats?.textContent).toMatch(/3/);
    expect(stats?.textContent).not.toMatch(/分类/);
  });

  it("shows 无 for zero dimension slots", async () => {
    renderContent();
    await screen.findByRole("button", { name: /仪表盘/ });
    await userEvent.setup().click(screen.getByRole("button", { name: /仪表盘/ }));
    expect(await screen.findByText("无")).toBeInTheDocument();
    expect(screen.getByText("1 个")).toBeInTheDocument();
  });

  it("filters list when section nav is clicked", async () => {
    const user = userEvent.setup();
    renderContent();
    await screen.findByRole("heading", { name: "折线图" });
    const nav = screen.getByRole("navigation", { name: "图表组件分区" });
    await user.click(nav.querySelectorAll("button")[1]!);
    expect(await screen.findByRole("heading", { name: "仪表盘" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "折线图" })).not.toBeInTheDocument();
  });
});

describe("ChartExploreDrawer", () => {
  afterEach(() => cleanup());

  it("opens catalog drawer from palette trigger", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);
    await user.click(screen.getByRole("button", { name: /查看全部类型与字段规则/ }));
    expect(await screen.findByText("图表类型目录")).toBeInTheDocument();
  });
});
