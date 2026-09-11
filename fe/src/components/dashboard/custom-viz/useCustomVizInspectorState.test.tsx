import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { CustomVizWidgetConfig } from "../layoutUtils";
import { useCustomVizInspectorState } from "./useCustomVizInspectorState";

const mockApiFetch = vi.fn();
const mockFetchDatasetQueryConfig = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

vi.mock("@/lib/datasetChartBinding", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/datasetChartBinding")>();
  return {
    ...actual,
    resolveDatasetChartBinding: (...args: unknown[]) => mockFetchDatasetQueryConfig(...args),
    fetchDatasetQueryConfig: (...args: unknown[]) => mockFetchDatasetQueryConfig(...args),
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useCustomVizInspectorState", () => {
  it("loads field columns immediately after dataset select without waiting for parent re-render", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/datasets")) {
        return {
          items: [
            {
              datasetId: "ds-sales",
              displayName: "销售宽表",
              boundConfigId: "cfg-1",
            },
          ],
        };
      }
      return {};
    });
    mockFetchDatasetQueryConfig.mockResolvedValue({
      configId: "cfg-1",
      dataSourceId: "dsrc-1",
      columns: ["region", "amount"],
    });

    let config: CustomVizWidgetConfig = {
      artifactId: "art-1",
      dataBinding: { status: "manual" },
    };
    const readConfig = () => config;
    const emitChange = (next: CustomVizWidgetConfig) => {
      config = next;
    };

    const { result, rerender } = renderHook(
      () => useCustomVizInspectorState(readConfig, emitChange),
      { wrapper },
    );

    await waitFor(() => expect(result.current.datasetItems).toHaveLength(1));

    await result.current.handleDatasetSelect("ds-sales");
    rerender();

    await waitFor(() => {
      expect(result.current.binding.configId).toBe("cfg-1");
      expect(result.current.columns).toEqual(["region", "amount"]);
    });
  });

  it("clears stale empty-field alert when columns arrive", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/datasets")) {
        return {
          items: [
            {
              datasetId: "ds-grid",
              displayName: "网格事件",
              boundConfigId: "cfg-grid",
            },
          ],
        };
      }
      return {};
    });
    mockFetchDatasetQueryConfig.mockResolvedValue({
      configId: "cfg-grid",
      dataSourceId: "dsrc-1",
      columns: ["grid_name", "event_count"],
    });

    let config: CustomVizWidgetConfig = {
      artifactId: "art-1",
      dataBinding: {
        status: "connected",
        datasetId: "ds-grid",
        configId: "cfg-grid",
        dataSourceId: "dsrc-1",
      },
    };
    const readConfig = () => config;
    const emitChange = (next: CustomVizWidgetConfig) => {
      config = next;
    };

    const { result } = renderHook(() => useCustomVizInspectorState(readConfig, emitChange), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.columns).toEqual(["grid_name", "event_count"]);
      expect(result.current.datasetBindingError).toBeNull();
    });
  });

  it("auto-suggests fields when dataset columns load", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/datasets")) {
        return {
          items: [
            {
              datasetId: "ds-sales",
              displayName: "销售宽表",
              boundConfigId: "cfg-1",
            },
          ],
        };
      }
      return {};
    });
    mockFetchDatasetQueryConfig.mockResolvedValue({
      configId: "cfg-1",
      dataSourceId: "dsrc-1",
      columns: ["province", "city", "amount"],
    });

    let config: CustomVizWidgetConfig = {
      artifactId: "art-1",
      dataBinding: { status: "manual" },
    };
    const readConfig = () => config;
    const emitChange = (next: CustomVizWidgetConfig) => {
      config = next;
    };
    const fieldSlots = {
      dimensions: { min: 1, max: 6, label: "明细列" },
      metrics: { min: 0, max: 0, label: "数值列" },
    };

    const { result, rerender } = renderHook(
      () => useCustomVizInspectorState(readConfig, emitChange, fieldSlots),
      { wrapper },
    );

    await waitFor(() => expect(result.current.datasetItems).toHaveLength(1));
    await result.current.handleDatasetSelect("ds-sales");
    rerender();

    await waitFor(() => {
      expect(result.current.binding.dimensions?.map((d) => d.field)).toEqual([
        "province",
        "city",
        "amount",
      ]);
    });
  });
});
