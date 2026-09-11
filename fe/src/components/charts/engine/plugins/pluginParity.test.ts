import { describe, expect, it } from "vitest";
import { BUILTIN_PLUGIN_DEFS } from "@/components/charts/engine/plugins/metadata";
import { listChartPluginTypes } from "@/components/charts/engine/plugins/registry";
import "@/components/charts/engine/plugins";

describe("chart plugin parity", () => {
  it("registers every builtin metadata type", () => {
    const metaTypes = new Set(BUILTIN_PLUGIN_DEFS.map((d) => d.type));
    const registered = new Set(listChartPluginTypes());
    for (const type of metaTypes) {
      expect(registered.has(type), `missing plugin registration: ${type}`).toBe(true);
    }
    expect(registered.size).toBe(metaTypes.size);
  });
});
