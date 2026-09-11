import { type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PixelShapePlayerProvider } from "@/components/dashboard/pixelCanvas/pixelShapePlayerContext";

describe("usePixelShapeLiveResize scope", () => {
  it("only listens while shape is playing", async () => {
    const handler = vi.fn();
    const handlerPlaying = vi.fn();
    const { usePixelShapeLiveResize } = await import("@/hooks/usePixelShapeLiveResize");
    const { dispatchPixelShapeLiveResize } = await import(
      "@/components/dashboard/pixelCanvas/pixelShapeLiveResize"
    );

    renderHook(() => usePixelShapeLiveResize(true, handler), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <PixelShapePlayerProvider playing={false}>{children}</PixelShapePlayerProvider>
      ),
    });
    dispatchPixelShapeLiveResize();
    expect(handler).not.toHaveBeenCalled();

    renderHook(() => usePixelShapeLiveResize(true, handlerPlaying), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <PixelShapePlayerProvider playing>{children}</PixelShapePlayerProvider>
      ),
    });
    dispatchPixelShapeLiveResize();
    expect(handlerPlaying).toHaveBeenCalledTimes(1);
  });
});
