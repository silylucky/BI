import { afterEach, describe, expect, it } from "vitest";
import { prefetchAdminRoute, resetRoutePrefetchForTests } from "./routePrefetch";

describe("routePrefetch", () => {
  afterEach(() => {
    resetRoutePrefetchForTests();
  });

  it("does not throw for registered admin paths", () => {
    expect(() => prefetchAdminRoute("/admin/dashboards")).not.toThrow();
    expect(() => prefetchAdminRoute("/admin/viz-templates")).not.toThrow();
  });

  it("ignores unknown paths", () => {
    expect(() => prefetchAdminRoute("/admin/unknown")).not.toThrow();
    expect(() => prefetchAdminRoute(undefined)).not.toThrow();
  });
});
