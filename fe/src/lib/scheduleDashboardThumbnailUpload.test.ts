import { afterEach, describe, expect, it, vi } from "vitest";
import { persistDashboardThumbnailBestEffort } from "./uploadDashboardThumbnail";

vi.mock("./uploadDashboardThumbnail", () => ({
  persistDashboardThumbnailBestEffort: vi.fn(async () => true),
}));

import { scheduleDashboardThumbnailUpload } from "./scheduleDashboardThumbnailUpload";

describe("scheduleDashboardThumbnailUpload", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls persist immediately without delay", async () => {
    scheduleDashboardThumbnailUpload("dash-1");
    await vi.waitFor(() => {
      expect(persistDashboardThumbnailBestEffort).toHaveBeenCalledWith("dash-1");
    });
  });

  it("runs onUploaded after successful persist", async () => {
    const onUploaded = vi.fn();
    scheduleDashboardThumbnailUpload("dash-3", { onUploaded });
    await vi.waitFor(() => {
      expect(onUploaded).toHaveBeenCalled();
    });
  });

  it("skips onUploaded when persist fails", async () => {
    vi.mocked(persistDashboardThumbnailBestEffort).mockResolvedValueOnce(false);
    const onUploaded = vi.fn();
    scheduleDashboardThumbnailUpload("dash-2", { onUploaded });
    await vi.waitFor(() => {
      expect(persistDashboardThumbnailBestEffort).toHaveBeenCalled();
    });
    expect(onUploaded).not.toHaveBeenCalled();
  });
});
