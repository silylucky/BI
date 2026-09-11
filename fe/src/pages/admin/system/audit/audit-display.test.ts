import { describe, expect, it } from "vitest";
import {
  auditActionLabel,
  formatAuditSummary,
  type AuditEventRow,
} from "./audit-display";

const baseEvent: AuditEventRow = {
  id: "00000000-0000-0000-0000-000000000001",
  actor_id: "00000000-0000-0000-0000-000000000002",
  actor_username: "admin",
  target_type: "user",
  target_id: "bae594c4-0000-4000-8000-000000000010",
  action: "user.roles.replace",
  detail: JSON.stringify({ role_ids: ["a87b9b99-c2ca-42f4-a82d-fb1b21f6968c"] }),
  trace_id: "trace-123",
  created_at: "2026-07-09T05:06:01.000Z",
};

describe("audit-display", () => {
  it("maps grant actions to Chinese labels", () => {
    expect(auditActionLabel("grant.create")).toBe("创建资源授权");
    expect(auditActionLabel("user.delete")).toBe("删除用户");
  });

  it("summarizes role replace detail", () => {
    expect(formatAuditSummary(baseEvent)).toBe("角色：1 个角色");
  });
});
