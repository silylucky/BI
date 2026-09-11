import { describe, expect, it } from "vitest";
import { DEFAULT_SCHEDULE_FORM } from "./components/ScheduleFormFields";
import { getScheduleFormValidation, isScheduleFormSubmittable } from "./scheduleDeliveryValidation";

describe("scheduleDeliveryValidation", () => {
  it("allows platform recipients without explicit email", () => {
    const form = {
      ...DEFAULT_SCHEDULE_FORM,
      recipients: [{ type: "role" as const, value: "admin" }],
    };
    expect(isScheduleFormSubmittable(form)).toBe(true);
  });

  it("requires email or platform recipients", () => {
    const form = {
      ...DEFAULT_SCHEDULE_FORM,
      recipients: [{ type: "email" as const, value: "" }],
    };
    const validation = getScheduleFormValidation(form);
    expect(validation.ok).toBe(false);
    expect(validation.message).toMatch(/邮箱/);
  });
});
