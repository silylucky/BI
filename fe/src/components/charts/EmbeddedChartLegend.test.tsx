import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useRef } from "react";
import {
  EmbeddedChartLegendShell,
  legendShellMaxHeightPx,
  resolveVerticalLegendPageSize,
} from "./EmbeddedChartLegend";

function createChartBodyProbe() {
  let instanceId = "";
  function ChartBody() {
    const idRef = useRef(`chart-${Math.random().toString(36).slice(2)}`);
    instanceId = idRef.current;
    return <div data-testid="chart-body">chart</div>;
  }
  return { ChartBody, getInstanceId: () => instanceId };
}

describe("EmbeddedChartLegendShell", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders legend below chart when position is bottom", () => {
    render(
      <EmbeddedChartLegendShell
        position="bottom"
        fontSize={20}
        items={[{ name: "访问", color: "#465fff" }]}
      >
        <div data-testid="chart-body">chart</div>
      </EmbeddedChartLegendShell>,
    );

    const legend = screen.getByLabelText("图例");
    const chart = screen.getByTestId("chart-body");
    expect(chart.compareDocumentPosition(legend) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(legend).toHaveStyle({ fontSize: "20px" });
  });

  it("caps horizontal legend height for adaptive layout", () => {
    render(
      <EmbeddedChartLegendShell
        position="bottom"
        fontSize={12}
        items={[
          { name: "A", color: "#111" },
          { name: "B", color: "#222" },
          { name: "C", color: "#333" },
          { name: "D", color: "#444" },
        ]}
      >
        <div data-testid="chart-body">chart</div>
      </EmbeddedChartLegendShell>,
    );
    const legend = screen.getByLabelText("图例");
    expect(legend).toHaveStyle({ maxHeight: `${legendShellMaxHeightPx(12)}px` });
  });

  it("renders vertical legend layout when orient is vertical", () => {
    render(
      <EmbeddedChartLegendShell
        position="right"
        orient="vertical"
        fontSize={12}
        icon="triangle"
        iconSize={6}
        items={[{ name: "访问", color: "#465fff" }]}
      >
        <div data-testid="chart-body">chart</div>
      </EmbeddedChartLegendShell>,
    );

    const legend = screen.getByLabelText("图例");
    expect(legend).toHaveClass("flex-col");
  });

  it("keeps chart area flex-1 when legend is on the side", () => {
    const { container } = render(
      <div className="w-[240px]">
        <EmbeddedChartLegendShell
          position="left"
          orient="horizontal"
          items={[{ name: "amount", color: "#465fff" }]}
        >
          <div data-testid="chart-body">chart</div>
        </EmbeddedChartLegendShell>
      </div>,
    );

    const chart = screen.getByTestId("chart-body");
    expect(chart.parentElement).toHaveClass("flex-1");
    expect(container.querySelector('[data-legend-slot="side"]')).toBeTruthy();
    expect(screen.getByLabelText("图例")).toHaveClass("flex-col");
  });

  it("does not remount chart children when legend items appear", () => {
    const { ChartBody, getInstanceId } = createChartBodyProbe();

    const { rerender } = render(
      <EmbeddedChartLegendShell position="bottom" items={[]}>
        <ChartBody />
      </EmbeddedChartLegendShell>,
    );
    const before = getInstanceId();

    rerender(
      <EmbeddedChartLegendShell
        position="bottom"
        items={[{ name: "访问", color: "#465fff" }]}
      >
        <ChartBody />
      </EmbeddedChartLegendShell>,
    );
    expect(getInstanceId()).toBe(before);
  });

  it("paginates horizontal legend when items exceed page size", () => {
    const manyItems = Array.from({ length: 10 }, (_, index) => ({
      name: `系列${index + 1}`,
      color: "#111",
    }));

    render(
      <EmbeddedChartLegendShell position="bottom" fontSize={12} items={manyItems}>
        <div data-testid="chart-body">chart</div>
      </EmbeddedChartLegendShell>,
    );

    const legend = screen.getByLabelText("图例");
    expect(within(legend).getByText("系列1")).toBeInTheDocument();
    expect(within(legend).queryByText("系列9")).not.toBeInTheDocument();
    expect(screen.getByLabelText("下一页图例")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("paginates vertical side legend when items exceed visible rows", () => {
    const manyItems = [
      "广东省",
      "江苏省",
      "北京市",
      "上海市",
      "四川省",
      "浙江省",
      "山东省",
      "河南省",
      "湖北省",
      "湖南省",
    ].map((name, index) => ({ name, color: `#${(index + 1).toString(16).padStart(3, "0")}` }));

    render(
      <div className="h-[120px] w-[240px]">
        <EmbeddedChartLegendShell position="left" orient="vertical" fontSize={12} items={manyItems}>
          <div data-testid="chart-body">chart</div>
        </EmbeddedChartLegendShell>
      </div>,
    );

    const legend = screen.getByLabelText("图例");
    expect(within(legend).getByText("广东省")).toBeInTheDocument();
    expect(within(legend).queryByText("湖南省")).not.toBeInTheDocument();
    expect(screen.getByLabelText("下一页图例")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("下一页图例"));
    expect(within(legend).getByText("湖南省")).toBeInTheDocument();
  });

  it("reserves pager height when estimating vertical page size", () => {
    expect(resolveVerticalLegendPageSize(120, 12, 20)).toBeLessThan(
      resolveVerticalLegendPageSize(120, 12, 4),
    );
  });

  it("uses overflow-visible on chart area when clipChart is false", () => {
    const { container } = render(
      <EmbeddedChartLegendShell
        position="bottom"
        items={[{ name: "A", color: "#111" }]}
        clipChart={false}
      >
        <div data-testid="chart-body">chart</div>
      </EmbeddedChartLegendShell>,
    );

    const chart = screen.getByTestId("chart-body");
    expect(chart.parentElement).toHaveClass("overflow-visible");
    expect(chart.parentElement).not.toHaveClass("overflow-hidden");
    expect(container.firstElementChild).toHaveClass("overflow-visible");
  });
});
