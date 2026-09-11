import type { PaletteDragPayload } from "@/lib/dashboardDnd";

/** 同步标记工具栏 palette 拖放会话（避免 document capture dragstart 早于 setData） */
let paletteDragSessionActive = false;
let paletteDragSessionPayload: PaletteDragPayload | null = null;

export function beginPaletteDragSession(payload: PaletteDragPayload): void {
  paletteDragSessionActive = true;
  paletteDragSessionPayload = payload;
}

export function endPaletteDragSession(): void {
  paletteDragSessionActive = false;
  paletteDragSessionPayload = null;
}

export function isPaletteDragSessionActive(): boolean {
  return paletteDragSessionActive;
}

/** dragover 阶段 getData 不可用，预览/命中须读会话缓存 */
export function getPaletteDragSessionPayload(): PaletteDragPayload | null {
  return paletteDragSessionPayload;
}
