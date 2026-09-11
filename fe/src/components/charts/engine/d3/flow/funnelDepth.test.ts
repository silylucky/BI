import { describe, expect, it } from "vitest";
import { funnelRightFacePath, funnelTopFacePath, funnelTrapezoidPath } from "./funnelDepth";

describe("funnelDepth paths", () => {
  it("extrudes the top face upward and the side face to the right", () => {
    const front = funnelTrapezoidPath(100, 20, 50, 80, 40);
    const top = funnelTopFacePath(100, 20, 50, 80, 40, 8);
    const side = funnelRightFacePath(100, 20, 50, 80, 40, 8);
    expect(front).toContain("20");
    expect(top).toContain("12");
    expect(side).toContain("148");
  });
});
