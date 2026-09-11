import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/apiUpload", () => ({
  apiUploadBlob: vi.fn(async () => undefined),
}));

vi.mock("@/lib/captureDashboardThumbnail", () => ({
  assertUsableImageBlob: (blob: Blob) => {
    if (!blob || blob.size < 256) throw new Error("截图生成为空");
  },
  captureDashboardThumbnailBlob: vi.fn(),
  findVizComponentThumbnailCaptureRoot: vi.fn(),
  findDashboardWidgetCaptureRoot: vi.fn(),
  waitForThumbnailCaptureReady: vi.fn(async (resolve: () => HTMLElement | null) => {
    const root = resolve();
    if (!root) throw new Error("未找到可截图的组件预览区域");
    return root;
  }),
  waitForGisMapCaptureReady: vi.fn(async () => undefined),
}));

import { apiUploadBlob } from "@/lib/apiUpload";
import {
  captureDashboardThumbnailBlob,
  findDashboardWidgetCaptureRoot,
  findVizComponentThumbnailCaptureRoot,
} from "@/lib/captureDashboardThumbnail";
import {
  persistVizComponentThumbnail,
  persistVizComponentThumbnailBestEffort,
  persistVizComponentThumbnailFromWidget,
} from "./uploadVizComponentThumbnail";

describe("persistVizComponentThumbnail", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("captures then uploads png", async () => {
    const blob = new Blob([new Uint8Array(512)], { type: "image/png" });
    vi.mocked(findVizComponentThumbnailCaptureRoot).mockReturnValue(document.createElement("div"));
    vi.mocked(captureDashboardThumbnailBlob).mockResolvedValue(blob);

    await persistVizComponentThumbnail("comp-1");

    expect(apiUploadBlob).toHaveBeenCalledWith(
      "/api/v1/viz-components/comp-1/thumbnail",
      blob,
      "image/png",
    );
  });

  it("throws when preview root is missing", async () => {
    vi.mocked(findVizComponentThumbnailCaptureRoot).mockReturnValue(null);
    await expect(persistVizComponentThumbnail("comp-1")).rejects.toThrow(/未找到/);
    expect(apiUploadBlob).not.toHaveBeenCalled();
  });

  it("best effort returns capture failure instead of throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(findVizComponentThumbnailCaptureRoot).mockReturnValue(null);
    await expect(persistVizComponentThumbnailBestEffort("comp-1")).resolves.toEqual({
      ok: false,
      stage: "capture",
      message: expect.stringMatching(/未找到/),
    });
    warn.mockRestore();
  });

  it("captures dashboard widget then uploads png", async () => {
    const blob = new Blob([new Uint8Array(512)], { type: "image/png" });
    vi.mocked(findDashboardWidgetCaptureRoot).mockReturnValue(document.createElement("div"));
    vi.mocked(captureDashboardThumbnailBlob).mockResolvedValue(blob);

    await persistVizComponentThumbnailFromWidget("comp-2", "widget-1");

    expect(findDashboardWidgetCaptureRoot).toHaveBeenCalledWith("widget-1");
    expect(apiUploadBlob).toHaveBeenCalledWith(
      "/api/v1/viz-components/comp-2/thumbnail",
      blob,
      "image/png",
    );
  });
});
