import { afterEach, describe, expect, it, vi } from "vitest";
import { persistDashboardThumbnail, persistDashboardThumbnailBestEffort } from "./uploadDashboardThumbnail";

vi.mock("@/lib/apiUpload", () => ({
  apiUploadBlob: vi.fn(async () => undefined),
}));

vi.mock("@/lib/captureDashboardThumbnail", () => ({
  assertUsableImageBlob: (blob: Blob) => {
    if (!blob || blob.size < 256) throw new Error("截图生成为空");
  },
  captureDashboardThumbnailBlob: vi.fn(),
  findDashboardThumbnailCaptureRoot: vi.fn(),
}));

import { apiUploadBlob } from "@/lib/apiUpload";
import {
  captureDashboardThumbnailBlob,
  findDashboardThumbnailCaptureRoot,
} from "@/lib/captureDashboardThumbnail";

describe("persistDashboardThumbnail", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("captures then uploads png", async () => {
    const blob = new Blob([new Uint8Array(512)], { type: "image/png" });
    vi.mocked(findDashboardThumbnailCaptureRoot).mockReturnValue(document.createElement("div"));
    vi.mocked(captureDashboardThumbnailBlob).mockResolvedValue(blob);

    await persistDashboardThumbnail("dash-1");

    expect(apiUploadBlob).toHaveBeenCalledWith(
      "/api/v1/dashboards/dash-1/thumbnail",
      blob,
      "image/png",
    );
  });

  it("throws when canvas root is missing", async () => {
    vi.mocked(findDashboardThumbnailCaptureRoot).mockReturnValue(null);
    await expect(persistDashboardThumbnail("dash-1")).rejects.toThrow(/未找到/);
    expect(apiUploadBlob).not.toHaveBeenCalled();
  });

  it("best effort returns false instead of throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(findDashboardThumbnailCaptureRoot).mockReturnValue(null);
    await expect(persistDashboardThumbnailBestEffort("dash-1")).resolves.toBe(false);
    warn.mockRestore();
  });
});
