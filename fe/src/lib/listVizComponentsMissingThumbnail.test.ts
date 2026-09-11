import { describe, expect, it, vi } from "vitest";
import { listVizComponentsMissingThumbnail } from "./listVizComponentsMissingThumbnail";

vi.mock("@/lib/vizComponents", () => ({
  fetchVizComponents: vi.fn(),
}));

import { fetchVizComponents } from "@/lib/vizComponents";

describe("listVizComponentsMissingThumbnail", () => {
  it("returns ids without thumbnailUrl across pages", async () => {
    vi.mocked(fetchVizComponents)
      .mockResolvedValueOnce({
        items: [
          { id: "a", thumbnailUrl: null },
          { id: "b", thumbnailUrl: "/api/v1/viz-components/b/thumbnail" },
        ],
        total: 3,
        limit: 2,
        offset: 0,
      } as never)
      .mockResolvedValueOnce({
        items: [{ id: "c", thumbnailUrl: null }],
        total: 3,
        limit: 2,
        offset: 2,
      } as never);

    await expect(listVizComponentsMissingThumbnail(true)).resolves.toEqual(["a", "c"]);
  });
});
