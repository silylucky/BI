import { describe, expect, it } from "vitest";
import { buildGraphLayoutStateKey } from "./forceGraphLayoutState";

describe("buildGraphLayoutStateKey", () => {
  const nodes = ["a", "b"];
  const links = [{ source: "a", target: "b" }];

  it("includes layout type so force and dagre do not share cache", () => {
    const forceKey = buildGraphLayoutStateKey("inst-1", nodes, links, "force");
    const dagreKey = buildGraphLayoutStateKey("inst-1", nodes, links, "dagre");
    expect(forceKey).not.toBe(dagreKey);
    expect(forceKey).toContain("|force|");
    expect(dagreKey).toContain("|dagre|");
  });
});
