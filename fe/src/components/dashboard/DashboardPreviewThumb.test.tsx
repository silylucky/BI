import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type {
  DashboardLayoutV1,
  DashboardLayoutV2,
} from "./layoutUtils";
import { DashboardPreviewThumb } from "./DashboardPreviewThumb";

afterEach(cleanup);

describe("DashboardPreviewThumb", () => {
  it("renders v1 widgets with grid spans", () => {
    const layout: DashboardLayoutV1 = {
      version: 1,
      widgets: [
        {
          id: "grid-widget",
          type: "text",
          title: "Grid",
          order: 0,
          colSpan: 4,
          rowSpan: 2,
        },
      ],
      globalFilters: [],
    };

    const { getByTestId } = render(
      <DashboardPreviewThumb layoutJson={layout} />,
    );

    expect(getByTestId("dashboard-preview-widget-grid-widget")).toHaveStyle({
      gridColumn: "span 4",
    });
  });

  it("renders v2 widgets from pixel geometry without colSpan fallback", () => {
    const layout: DashboardLayoutV2 = {
      version: 2,
      canvas: { width: 1440, height: 900 },
      widgets: [
        {
          id: "pixel-widget",
          type: "text",
          title: "Pixel",
          order: 0,
          x: 144,
          y: 90,
          width: 720,
          height: 450,
        },
      ],
      globalFilters: [],
    };

    const { getByTestId } = render(
      <DashboardPreviewThumb layoutJson={layout} />,
    );

    expect(getByTestId("dashboard-preview-widget-pixel-widget")).toHaveStyle({
      left: "10%",
      top: "10%",
      width: "50%",
      height: "50%",
    });
  });

  it("renders chart mock visuals for chart widgets", () => {
    const layout: DashboardLayoutV2 = {
      version: 2,
      canvas: { width: 1440, height: 900 },
      widgets: [
        {
          id: "bar-widget",
          type: "chart",
          title: "销售",
          order: 0,
          x: 0,
          y: 0,
          width: 400,
          height: 300,
          chartConfig: { chartType: "bar" } as never,
        },
      ],
      globalFilters: [],
    };

    const { getByTestId, container } = render(
      <DashboardPreviewThumb layoutJson={layout} />,
    );

    expect(getByTestId("dashboard-preview-widget-bar-widget")).toBeInTheDocument();
    expect(container.querySelector("svg rect")).toBeTruthy();
  });

  it("uses data-screen dark canvas background", () => {
    const layout: DashboardLayoutV2 = {
      version: 2,
      canvas: { width: 1920, height: 1080 },
      styleConfig: { surfaceKind: "data-screen" },
      widgets: [
        {
          id: "screen-widget",
          type: "chart",
          title: "Screen",
          order: 0,
          x: 0,
          y: 0,
          width: 960,
          height: 540,
        },
      ],
      globalFilters: [],
    };

    const { getByTestId } = render(
      <DashboardPreviewThumb layoutJson={layout} isDataScreen />,
    );

    expect(getByTestId("dashboard-preview-thumb")).toHaveClass("from-slate-950");
  });

  it("uses a tall v2 canvas aspect ratio without distorting percentages", () => {
    const layout: DashboardLayoutV2 = {
      version: 2,
      canvas: { width: 1440, height: 1800 },
      widgets: [
        {
          id: "tall-widget",
          type: "text",
          title: "Tall",
          order: 0,
          x: 144,
          y: 900,
          width: 720,
          height: 450,
        },
      ],
      globalFilters: [],
    };

    const { getByTestId } = render(
      <DashboardPreviewThumb layoutJson={layout} />,
    );

    expect(getByTestId("dashboard-preview-thumb")).toHaveStyle({
      aspectRatio: "1440 / 1800",
    });
    expect(getByTestId("dashboard-preview-widget-tall-widget")).toHaveStyle({
      left: "10%",
      top: "50%",
      width: "50%",
      height: "25%",
    });
  });
});
