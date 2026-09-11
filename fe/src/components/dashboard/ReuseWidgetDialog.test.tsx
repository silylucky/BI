import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VizReuseDialog } from "./VizReuseDialog";
import type { DashboardLayoutV1, DashboardLayoutV2 } from "./layoutUtils";
import { TEMPLATE_DEMO_DATASOURCE_REF } from "@/lib/templateDemoData";
import * as vizComponentEdit from "@/lib/vizComponentEdit";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "@/lib/api";

const v1Layout: DashboardLayoutV1 = {
  version: 1,
  widgets: [
    {
      id: "w-v1",
      type: "text",
      title: "V1 文本",
      order: 0,
      colSpan: 6,
      rowSpan: 2,
      textConfig: { content: "hello", variant: "plain" },
    },
  ],
  globalFilters: [],
};

const v2Layout: DashboardLayoutV2 = {
  version: 2,
  canvas: { width: 1440, height: 1800 },
  widgets: [
    {
      id: "w-v2",
      type: "text",
      title: "V2 文本",
      order: 0,
      x: 120,
      y: 900,
      width: 600,
      height: 280,
      textConfig: { content: "pixel", variant: "plain" },
    },
  ],
  globalFilters: [],
};

function renderDialog(onInsertCloned = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VizReuseDialog
        open
        onOpenChange={() => {}}
        currentDashboardId="current"
        widgets={[]}
        targetPixelWidgets={[]}
        onInsertCloned={onInsertCloned}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("VizReuseDialog", () => {
  it("clones v1 widget without pixel geometry", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path.includes("/viz-components")) {
        return { items: [], total: 0, limit: 50, offset: 0 };
      }
      if (path.includes("?limit=")) {
        return { items: [{ id: "src", name: "来源看板" }] };
      }
      return { layoutJson: v1Layout };
    });

    renderDialog(onInsert);
    await user.click(screen.getByRole("button", { name: "从其他看板" }));
    const [dashboardSelect] = screen.getAllByRole("combobox");
    await user.click(dashboardSelect);
    await user.click(await screen.findByRole("option", { name: "来源看板" }));
    const [, widgetSelect] = screen.getAllByRole("combobox");
    await user.click(widgetSelect);
    await user.click(await screen.findByRole("option", { name: "V1 文本 (text)" }));
    await user.click(screen.getByRole("button", { name: "插入副本" }));

    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert.mock.calls[0][0]).toMatchObject({
      title: "V1 文本",
      textConfig: { content: "hello", variant: "plain" },
    });
    expect(onInsert.mock.calls[0][1]).toBeUndefined();
  });

  it("clones v2 widget and passes source pixel geometry", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path.includes("/viz-components")) {
        return { items: [], total: 0, limit: 50, offset: 0 };
      }
      if (path.includes("?limit=")) {
        return { items: [{ id: "src", name: "像素看板" }] };
      }
      return { layoutJson: v2Layout };
    });

    renderDialog(onInsert);
    await user.click(screen.getByRole("button", { name: "从其他看板" }));
    const [dashboardSelect] = screen.getAllByRole("combobox");
    await user.click(dashboardSelect);
    await user.click(await screen.findByRole("option", { name: "像素看板" }));
    const [, widgetSelect] = screen.getAllByRole("combobox");
    await user.click(widgetSelect);
    await user.click(await screen.findByRole("option", { name: "V2 文本 (text)" }));
    await user.click(screen.getByRole("button", { name: "插入副本" }));

    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert.mock.calls[0][1]).toMatchObject({
      width: 600,
      height: 280,
      title: "V2 文本",
    });
  });

  it("copies linked chart as inline snapshot with demo dataSourceId", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    const linkedLayout: DashboardLayoutV1 = {
      version: 1,
      widgets: [
        {
          id: "w-linked",
          type: "chart",
          title: "引用图表",
          order: 0,
          colSpan: 6,
          rowSpan: 4,
          componentRef: { componentId: "550e8400-e29b-41d4-a716-446655440001" },
        },
      ],
      globalFilters: [],
    };
    vi.spyOn(vizComponentEdit, "resolveWidgetForCrossDashboardCopy").mockResolvedValue({
      id: "w-linked",
      type: "chart",
      title: "引用图表",
      order: 0,
      colSpan: 6,
      rowSpan: 4,
      chartConfig: {
        chartId: "w-linked",
        chartType: "bar",
        mode: "sql",
        sql: "SELECT amount FROM orders",
        dataSourceId: TEMPLATE_DEMO_DATASOURCE_REF,
      },
    } as DashboardLayoutV1["widgets"][number]);
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path.includes("/viz-components")) {
        return { items: [], total: 0, limit: 50, offset: 0 };
      }
      if (path.includes("?limit=")) {
        return { items: [{ id: "src-linked", name: "来源看板" }] };
      }
      return { layoutJson: linkedLayout };
    });

    renderDialog(onInsert);
    await user.click(screen.getByRole("button", { name: "从其他看板" }));
    const [dashboardSelect] = screen.getAllByRole("combobox");
    await user.click(dashboardSelect);
    await user.click(await screen.findByRole("option", { name: "来源看板" }));
    const [, widgetSelect] = screen.getAllByRole("combobox");
    await user.click(widgetSelect);
    await user.click(await screen.findByRole("option", { name: "引用图表 (chart)" }));
    await user.click(screen.getByRole("button", { name: "插入副本" }));

    await waitFor(() => expect(onInsert).toHaveBeenCalledTimes(1));
    const inserted = onInsert.mock.calls[0][0];
    expect(inserted.componentRef).toBeUndefined();
    expect(inserted.chartConfig?.sql).toBe("SELECT amount FROM orders");
    expect(inserted.chartConfig?.dataSourceId).toBe(TEMPLATE_DEMO_DATASOURCE_REF);
  });
});
