import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDocumentFullscreen } from "./useDocumentFullscreen";

describe("useDocumentFullscreen", () => {
  beforeEach(() => {
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tracks fullscreenchange events", () => {
    const { result } = renderHook(() => useDocumentFullscreen());
    expect(result.current.isFullscreen).toBe(false);

    act(() => {
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        value: document.documentElement,
      });
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    expect(result.current.isFullscreen).toBe(true);
  });

  it("toggles fullscreen on documentElement", () => {
    const requestFullscreen = vi.fn();
    const exitFullscreen = vi.fn();
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitFullscreen,
    });

    const { result } = renderHook(() => useDocumentFullscreen());

    act(() => {
      result.current.toggleFullscreen();
    });
    expect(requestFullscreen).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: document.documentElement,
    });

    act(() => {
      result.current.toggleFullscreen();
    });
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });
});
