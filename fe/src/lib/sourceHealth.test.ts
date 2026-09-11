import { describe, expect, it } from "vitest";
import {
  isSourceUnavailable,
  sourceHealthAlertDescription,
  sourceHealthBadgeLabel,
} from "@/lib/sourceHealth";

describe("sourceHealth", () => {
  it("marks missing datasource as unavailable", () => {
    expect(isSourceUnavailable("missing")).toBe(true);
    expect(isSourceUnavailable("active")).toBe(false);
    expect(sourceHealthBadgeLabel("missing")).toBe("数据源不可用");
  });

  it("provides entity-specific alert copy", () => {
    expect(sourceHealthAlertDescription("dataset")).toContain("Dataset");
    expect(sourceHealthAlertDescription("sync_job")).toContain("同步");
  });
});
