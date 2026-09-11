import { describe, expect, it } from "vitest";
import {
  guardDialogDismiss,
  isAnySelectDropdownOpen,
  isDialogNestedPortaledLayer,
  shouldBlockDialogClose,
} from "./dialogNestedDismissGuard";

describe("dialogNestedDismissGuard", () => {
  it("detects portaled select content as nested layer", () => {
    const host = document.createElement("div");
    host.setAttribute("data-slot", "select-content");
    const item = document.createElement("div");
    host.appendChild(item);
    document.body.appendChild(host);
    expect(isDialogNestedPortaledLayer(item)).toBe(true);
    host.remove();
  });

  it("blocks dismiss while select dropdown is open", () => {
    const host = document.createElement("div");
    host.setAttribute("data-slot", "select-content");
    host.setAttribute("data-state", "open");
    document.body.appendChild(host);
    expect(isAnySelectDropdownOpen()).toBe(true);
    const event = new Event("pointerdown", { cancelable: true });
    guardDialogDismiss(event);
    expect(event.defaultPrevented).toBe(true);
    host.remove();
  });

  it("blocks dismiss when original pointer path includes select content", () => {
    const host = document.createElement("div");
    host.setAttribute("data-slot", "select-content");
    const item = document.createElement("div");
    host.appendChild(item);
    document.body.appendChild(host);
    const event = new Event("pointerdown", { cancelable: true });
    Object.defineProperty(event, "composedPath", {
      value: () => [item, host, document.body],
    });
    Object.defineProperty(event, "target", { value: document.body });
    guardDialogDismiss(event);
    expect(event.defaultPrevented).toBe(true);
    host.remove();
  });

  it("blocks dialog close while combobox is expanded", () => {
    const trigger = document.createElement("button");
    trigger.setAttribute("role", "combobox");
    trigger.setAttribute("aria-expanded", "true");
    document.body.appendChild(trigger);
    expect(isAnySelectDropdownOpen()).toBe(true);
    expect(shouldBlockDialogClose()).toBe(true);
    trigger.remove();
  });
});
