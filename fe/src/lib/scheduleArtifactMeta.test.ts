import { describe, expect, it } from "vitest";
import {
  isLayoutInventoryArtifact,
  localizeArtifactKind,
  LAYOUT_INVENTORY_NOTICE,
} from "./scheduleArtifactMeta";

describe("scheduleArtifactMeta", () => {
  it("localizes artifact kinds", () => {
    expect(localizeArtifactKind("layout_inventory")).toBe("布局摘要");
    expect(localizeArtifactKind("visual_snapshot")).toBe("可视化快照");
    expect(localizeArtifactKind("visual_snapshot_full_page")).toBe("高清整页快照");
    expect(isLayoutInventoryArtifact("layout_inventory")).toBe(true);
    expect(isLayoutInventoryArtifact("visual_snapshot")).toBe(false);
  });

  it("exposes layout inventory notice copy", () => {
    expect(LAYOUT_INVENTORY_NOTICE).toMatch(/布局摘要/);
  });
});
