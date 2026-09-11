import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useVizComponentEditor } from "./useVizComponentEditor";

const mockFetchVizComponent = vi.fn();

vi.mock("@/lib/vizComponents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vizComponents")>();
  return {
    ...actual,
    fetchVizComponent: (...args: unknown[]) => mockFetchVizComponent(...args),
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useVizComponentEditor", () => {
  it("does not reset local widget when detail query refetches the same revision", async () => {
    const baseDetail = {
      id: "comp-1",
      componentKey: "alert-feed",
      name: "实时告警滚动条",
      description: null,
      categoryKey: "custom",
      widgetType: "customViz" as const,
      surfaceKinds: ["data-screen" as const],
      status: "published" as const,
      thumbnailRef: null,
      tags: [],
      visibility: "org" as const,
      contentRevision: 3,
      updatedAt: "2026-08-18T00:00:00Z",
      publishedAt: "2026-08-18T00:00:00Z",
      payloadJson: {
        customVizConfig: {
          artifactId: "550e8400-e29b-41d4-a716-446655440000",
          dataBinding: { status: "manual" },
        },
      },
      ownerUserId: null,
      orgScope: null,
      createdAt: "2026-08-18T00:00:00Z",
    };

    mockFetchVizComponent.mockResolvedValue(baseDetail);

    const { result } = renderHook(() => useVizComponentEditor("comp-1"), { wrapper });

    await waitFor(() => expect(result.current.widget).not.toBeNull());

    result.current.patchWidget({
      customVizConfig: {
        artifactId: "550e8400-e29b-41d4-a716-446655440000",
        dataBinding: {
          status: "connected",
          datasetId: "ds-alerts",
          configId: "cfg-alerts",
        },
      },
    });

    await waitFor(() =>
      expect(result.current.widget?.customVizConfig?.dataBinding?.datasetId).toBe("ds-alerts"),
    );

    mockFetchVizComponent.mockResolvedValue({ ...baseDetail, updatedAt: "2026-08-18T01:00:00Z" });
    await result.current.refetch();

    await waitFor(() => expect(mockFetchVizComponent).toHaveBeenCalledTimes(2));
    expect(result.current.widget?.customVizConfig?.dataBinding?.datasetId).toBe("ds-alerts");
  });
});
