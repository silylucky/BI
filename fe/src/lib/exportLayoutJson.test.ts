import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import type { DashboardLayoutV2 } from "@/components/dashboard/layoutUtils";
import { parseImportedDataScreenLayout } from "./dataScreenTemplates";
import { downloadJsonFile, downloadLayoutJson } from "./exportLayoutJson";

const layout: DashboardLayoutV2 = {
  version: 2,
  canvas: { width: 1920, height: 1080 },
  widgets: [
    {
      id: "w1",
      type: "chart",
      title: "销售",
      order: 1,
      x: 100,
      y: 80,
      width: 480,
      height: 300,
      chartConfig: {
        chartType: "bar",
        chartId: "w1",
        mode: "sql",
        dataSourceId: "00000000-0000-4000-8000-000000000001",
        sql: "SELECT 1",
        dimensions: [],
        metrics: [],
      },
    },
  ],
  globalFilters: [],
  styleConfig: { surfaceKind: "data-screen", colorScheme: "dark" },
};

beforeEach(() => {
  vi.stubGlobal(
    "URL",
    Object.assign(new URL("https://example.test"), {
      createObjectURL: vi.fn(() => "blob:test"),
      revokeObjectURL: vi.fn(),
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("exportLayoutJson", () => {
  it("round-trips raw layout JSON through list import parser", () => {
    const imported = parseImportedDataScreenLayout(layout);
    expect(imported.canvas).toEqual(layout.canvas);
    expect(imported.widgets).toHaveLength(1);
    expect(imported.styleConfig?.surfaceKind).toBe("data-screen");
  });

  it("downloads layout JSON with sanitized filename", () => {
    const anchor = {
      href: "",
      download: "",
      click: vi.fn(),
    } as unknown as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValue(anchor);

    downloadLayoutJson(layout, "演示 大屏!!");

    expect(anchor.download).toBe("演示-大屏--layout.json");
    expect(anchor.click).toHaveBeenCalled();
  });

  it("downloadJsonFile serializes layout compatible with import parser", () => {
    const anchor = {
      href: "",
      download: "",
      click: vi.fn(),
    } as unknown as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValue(anchor);

    downloadJsonFile(layout, "screen-layout.json");

    const parsed = parseImportedDataScreenLayout(JSON.parse(JSON.stringify(layout, null, 2)));
    expect(parsed.widgets[0]?.id).toBe("w1");
    expect(anchor.click).toHaveBeenCalled();
  });
});
