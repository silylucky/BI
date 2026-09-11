import { describe, expect, it, beforeEach } from "vitest";
import {
  beginPaletteDragSession,
  endPaletteDragSession,
  getPaletteDragSessionPayload,
  isPaletteDragSessionActive,
} from "@/lib/paletteDragSession";
import { readPaletteDragPayload, setChartTypeDragData } from "@/lib/dashboardDnd";
import { resolvePaletteDropPreviewRect } from "@/components/dashboard/pixelCanvas/createPixelWidget";

describe("paletteDragSession", () => {
  beforeEach(() => {
    endPaletteDragSession();
  });

  it("tracks drag session and payload synchronously", () => {
    expect(isPaletteDragSessionActive()).toBe(false);
    beginPaletteDragSession("word-cloud");
    expect(isPaletteDragSessionActive()).toBe(true);
    expect(getPaletteDragSessionPayload()).toBe("word-cloud");
    endPaletteDragSession();
    expect(getPaletteDragSessionPayload()).toBeNull();
  });

  it("begins session when chart drag data is set", () => {
    const transfer = {
      types: [] as string[],
      effectAllowed: "none",
      setData(type: string, value: string) {
        this.types.push(type);
      },
      getData: () => "",
    } as DataTransfer;

    setChartTypeDragData(transfer, "word-cloud");
    expect(isPaletteDragSessionActive()).toBe(true);
    expect(getPaletteDragSessionPayload()).toBe("word-cloud");
  });

  it("falls back to session payload during dragover when getData is empty", () => {
    beginPaletteDragSession("bar");
    const transfer = {
      types: ["application/vnd.vitalspan.chart-type"],
      getData: () => "",
    } as unknown as DataTransfer;
    const event = { dataTransfer: transfer } as DragEvent;
    expect(readPaletteDragPayload(event)).toBe("bar");
  });
});

describe("resolvePaletteDropPreviewRect", () => {
  it("centers preview on pointer and clamps to canvas", () => {
    const rect = resolvePaletteDropPreviewRect(
      { x: 100, y: 200 },
      "word-cloud",
      { width: 1440, height: 900 },
    );
    expect(rect).toEqual({ x: 0, y: 50, width: 480, height: 300 });
  });
});
