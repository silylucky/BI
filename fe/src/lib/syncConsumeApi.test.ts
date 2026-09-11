import { describe, expect, it } from "vitest";
import {
  consumeActionAriaLabel,
  consumeActionHref,
  consumeLabelText,
} from "@/lib/syncConsumeApi";

describe("syncConsumeApi consume actions", () => {
  it("maps ensure_dataset to 去建 Dataset label and history href", () => {
    expect(consumeActionAriaLabel("ensure_dataset")).toBe("去建 Dataset");
    expect(consumeActionHref("job-1", "ensure_dataset")).toBe(
      "/admin/ingestion/sync-jobs/job-1/history",
    );
  });

  it("maps open_dashboard to 一键出图 and dashboards href", () => {
    expect(consumeActionAriaLabel("open_dashboard")).toBe("一键出图");
    expect(consumeActionHref("job-1", "open_dashboard")).toBe("/admin/dashboards");
  });

  it("maps prepare to 准备出图环境", () => {
    expect(consumeActionAriaLabel("prepare")).toBe("准备出图环境");
    expect(consumeLabelText("pending_prepare")).toBe("待准备");
  });
});
