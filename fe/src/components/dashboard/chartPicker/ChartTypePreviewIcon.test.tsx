import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import "@/components/charts/engine/plugins/index";
import { BUILTIN_PLUGIN_DEFS } from "@/components/charts/engine/plugins/metadata";
import { ChartTypePreviewIcon } from "@/components/dashboard/chartPicker/ChartTypePreviewIcon";

describe("ChartTypePreviewIcon", () => {
  it("renders preview svg for each active chart type", () => {
    for (const def of BUILTIN_PLUGIN_DEFS) {
      if (def.deprecated) continue;
      const { container } = render(<ChartTypePreviewIcon type={def.type} />);
      const svg = container.querySelector("svg");
      expect(svg, def.type).toBeTruthy();
      expect(svg?.children.length, def.type).toBeGreaterThan(0);
    }
  });
});
