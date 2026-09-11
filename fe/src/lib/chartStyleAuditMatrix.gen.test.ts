import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { BUILTIN_PLUGIN_DEFS } from "@/components/charts/engine/plugins/metadata";
import {
  buildFullAuditMatrix,
  renderAuditMatrixMarkdown,
} from "./chartStyleAuditMatrix";

const OUT_PATH = join(
  dirname(dirname(dirname(__dirname))),
  "docs",
  "material",
  "chart-style-audit",
  "2026-08-03-full-matrix.md",
);

describe("chartStyleAuditMatrix generator", () => {
  it("covers 49 chart types + 4 widgets + 3 dashboard entries", () => {
    const rows = buildFullAuditMatrix();
    expect(BUILTIN_PLUGIN_DEFS).toHaveLength(49);
    expect(rows.filter((r) => r.category === "chart")).toHaveLength(49);
    expect(rows.filter((r) => r.category === "widget")).toHaveLength(4);
    expect(rows.filter((r) => r.category === " " as never)).toHaveLength(0);
    expect(rows.filter((r) => r.category === "dashboard")).toHaveLength(3);
    expect(rows).toHaveLength(56);
  });

  it("writes full audit matrix markdown", () => {
    const md = renderAuditMatrixMarkdown();
    expect(md).toContain("P0-1");
    expect(md).toContain("| bar |");
    expect(md).toContain("| filter |");
    expect(md).toContain("| dashboard-style |");
    mkdirSync(dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, md, "utf8");
  });
});
