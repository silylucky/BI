import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProceduralStars } from "@/components/charts/engine/maplibre/gisStarfield";

describe("gisStarfield regression", () => {
  it("does not skip stars inside a globe disc hole", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/charts/engine/maplibre/gisStarfield.ts"),
      "utf8",
    );
    expect(source).not.toContain("isInsideGlobeDisc");
  });

  it("still builds full-screen star field", () => {
    const stars = buildProceduralStars(400, 300);
    expect(stars.length).toBeGreaterThan(100);
  });
});
