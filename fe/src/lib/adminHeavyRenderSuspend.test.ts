import { afterEach, describe, expect, it } from "vitest";
import {
  beginAdminNavTransition,
  endAdminNavTransition,
  getAdminHeavyRenderSuspendSnapshot,
  resetAdminNavTransitionForTests,
} from "./adminHeavyRenderSuspend";

describe("adminHeavyRenderSuspend", () => {
  afterEach(() => {
    resetAdminNavTransitionForTests();
  });

  it("begins and ends nav transition", () => {
    expect(getAdminHeavyRenderSuspendSnapshot()).toBe(false);
    beginAdminNavTransition();
    expect(getAdminHeavyRenderSuspendSnapshot()).toBe(true);
    endAdminNavTransition();
    expect(getAdminHeavyRenderSuspendSnapshot()).toBe(false);
  });

  it("begin is idempotent while suspended", () => {
    beginAdminNavTransition();
    beginAdminNavTransition();
    expect(getAdminHeavyRenderSuspendSnapshot()).toBe(true);
  });
});
