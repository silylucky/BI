import { describe, expect, it } from "vitest";
import { executionErrorHeadline } from "./scheduleHistoryPresentation";
import { executionStatusColor } from "./useReportSchedules";

describe("executionErrorHeadline", () => {
  it("hides SMTP 550 payload behind a recipient hint", () => {
    expect(
      executionErrorHeadline(
        "邮件投递失败：(550, b'The recipient may contain a non-existent account, please check the recipient address.')",
      ),
    ).toBe("邮件投递失败，请核对收件地址");
  });

  it("keeps the clause before parentheses for other errors", () => {
    expect(executionErrorHeadline("连接超时：(ETIMEDOUT)")).toBe("连接超时");
  });
});

describe("executionStatusColor", () => {
  it("maps degraded delivery to warning", () => {
    expect(executionStatusColor("delivery_degraded")).toBe("warning");
    expect(executionStatusColor("semi_real_delivery_degraded")).toBe("warning");
  });
});
