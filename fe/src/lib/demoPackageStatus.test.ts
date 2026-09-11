import { describe, expect, it, vi } from "vitest";
import { fetchDemoPackageStatus } from "./demoPackageStatus";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "@/lib/api";

describe("demoPackageStatus", () => {
  it("fetches status from demo-package API", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ready: true,
      mysqlReachable: true,
      schemaVersion: 3,
      datasourceId: "ds-demo",
      datasourceCode: "demo",
      demoDashboardIds: ["d1", "d2", "d3"],
      message: null,
    });

    const status = await fetchDemoPackageStatus();
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/demo-package/status");
    expect(status.ready).toBe(true);
    expect(status.datasourceCode).toBe("demo");
  });

  it("supports refresh query param", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ready: false,
      mysqlReachable: false,
      schemaVersion: 0,
      datasourceId: null,
      datasourceCode: "demo",
      demoDashboardIds: [],
      message: "sample_db 不可达",
    });

    await fetchDemoPackageStatus(true);
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/demo-package/status?refresh=true");
  });
});
