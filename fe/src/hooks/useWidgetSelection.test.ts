import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useWidgetSelection } from "./useWidgetSelection";

describe("useWidgetSelection", () => {
  it("keeps selection reference when re-selecting the same widget", () => {
    const { result } = renderHook(() => useWidgetSelection());

    act(() => {
      result.current.handleSelect("w1", false);
    });
    const first = result.current.selectedIds;

    act(() => {
      result.current.handleSelect("w1", false);
    });

    expect(result.current.selectedIds).toBe(first);
    expect([...result.current.selectedIds]).toEqual(["w1"]);
  });

  it("replaces selection when selecting another widget", () => {
    const { result } = renderHook(() => useWidgetSelection());

    act(() => {
      result.current.handleSelect("w1", false);
    });
    const first = result.current.selectedIds;

    act(() => {
      result.current.handleSelect("w2", false);
    });

    expect(result.current.selectedIds).not.toBe(first);
    expect([...result.current.selectedIds]).toEqual(["w2"]);
  });
});
