import { type ReactNode, useRef } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PixelShapePlayerProvider } from "@/components/dashboard/pixelCanvas/pixelShapePlayerContext";
import { useEmbeddedChartLiveResize } from "@/hooks/useEmbeddedChartLiveResize";

function triggerResizeObservers() {
  (
    globalThis as typeof globalThis & {
      __triggerResizeObservers: () => void;
    }
  ).__triggerResizeObservers();
}

async function flushRaf() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

function wrapper({ children }: { children: ReactNode }) {
  return <PixelShapePlayerProvider playing={false}>{children}</PixelShapePlayerProvider>;
}

describe("useEmbeddedChartLiveResize", () => {
  let host: HTMLDivElement;

  afterEach(() => {
    host?.remove();
  });

  it("does not live-resize when observed width/height are unchanged", async () => {
    host = document.createElement("div");
    Object.defineProperties(host, {
      clientWidth: { configurable: true, value: 200 },
      clientHeight: { configurable: true, value: 120 },
    });
    document.body.appendChild(host);
    const onLive = vi.fn();
    const onCommit = vi.fn();

    renderHook(
      () => {
        const ref = useRef<HTMLElement | null>(host);
        useEmbeddedChartLiveResize(true, ref, onLive, onCommit);
      },
      { wrapper },
    );

    await flushRaf();
    expect(onLive).toHaveBeenCalledTimes(1);

    await act(async () => {
      triggerResizeObservers();
    });
    await flushRaf();
    expect(onLive).toHaveBeenCalledTimes(1);

    Object.defineProperty(host, "clientWidth", { configurable: true, value: 260 });
    await act(async () => {
      triggerResizeObservers();
    });
    await flushRaf();
    expect(onLive).toHaveBeenCalledTimes(2);
    expect(onCommit).not.toHaveBeenCalled();
  });
});
