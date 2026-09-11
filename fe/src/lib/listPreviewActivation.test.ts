import { afterEach, describe, expect, it } from "vitest";
import {
  getActiveListPreviewCountForTests,
  ListPreviewSlotResetError,
  releaseAllListPreviewSlots,
  releaseListPreviewSlot,
  requestListPreviewSlot,
  resetListPreviewActivationForTests,
  unregisterListPreviewWaiter,
  MAX_LIST_PREVIEW_ACTIVATIONS,
} from "./listPreviewActivation";

describe("listPreviewActivation", () => {
  afterEach(() => {
    resetListPreviewActivationForTests();
  });

  it("grants slots up to the concurrent limit", async () => {
    const slots = Array.from({ length: MAX_LIST_PREVIEW_ACTIVATIONS }, (_, index) =>
      requestListPreviewSlot({ key: `slot-${index}`, priority: 0.5 }),
    );
    await Promise.all(slots);
    expect(getActiveListPreviewCountForTests()).toBe(MAX_LIST_PREVIEW_ACTIVATIONS);
  });

  it("queues additional requests until a slot is released", async () => {
    const slots = Array.from({ length: MAX_LIST_PREVIEW_ACTIVATIONS }, (_, index) =>
      requestListPreviewSlot({ key: `slot-${index}`, priority: 0.5 }),
    );
    await Promise.all(slots);
    const pending = requestListPreviewSlot({ key: "pending", priority: 0.5 });
    let resolved = false;
    void pending.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    releaseListPreviewSlot("slot-0");
    await pending;
    expect(resolved).toBe(true);
  });

  it("grants higher priority waiter first when slots are limited", async () => {
    await Promise.all(
      Array.from({ length: MAX_LIST_PREVIEW_ACTIVATIONS }, (_, index) =>
        requestListPreviewSlot({ key: `low-${index}`, priority: 0.1 }),
      ),
    );
    const low = requestListPreviewSlot({ key: "pending-low", priority: 0.2 });
    const high = requestListPreviewSlot({ key: "pending-high", priority: 0.9 });
    releaseListPreviewSlot("low-0");
    await high;
    let lowResolved = false;
    void low.then(() => {
      lowResolved = true;
    });
    await Promise.resolve();
    expect(lowResolved).toBe(false);
    releaseListPreviewSlot("low-1");
    await low;
    expect(lowResolved).toBe(true);
  });

  it("does not grant unregisterled waiters", async () => {
    await Promise.all(
      Array.from({ length: MAX_LIST_PREVIEW_ACTIVATIONS }, (_, index) =>
        requestListPreviewSlot({ key: `slot-${index}`, priority: 0.5 }),
      ),
    );
    const pending = requestListPreviewSlot({ key: "gone", priority: 0.9 });
    let resolved = false;
    void pending.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    unregisterListPreviewWaiter("gone");
    releaseListPreviewSlot("slot-0");
    await Promise.resolve();
    expect(resolved).toBe(false);
  });

  it("rejects queued waiters when navigation clears all slots", async () => {
    await Promise.all(
      Array.from({ length: MAX_LIST_PREVIEW_ACTIVATIONS }, (_, index) =>
        requestListPreviewSlot({ key: `slot-${index}`, priority: 0.5 }),
      ),
    );
    const pending = requestListPreviewSlot({ key: "pending", priority: 0.5 });
    releaseAllListPreviewSlots();
    await expect(pending).rejects.toBeInstanceOf(ListPreviewSlotResetError);
  });
});
