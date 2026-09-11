import { describe, expect, it } from "vitest";
import { isDevUserSwitchEnabled } from "./dev-user-switch";

describe("dev-user-switch", () => {
  it("is enabled in vitest dev mode", () => {
    expect(isDevUserSwitchEnabled()).toBe(true);
  });
});
