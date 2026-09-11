import { describe, expect, it } from "vitest";
import { buildDefaultLayoutForSurface } from "@/lib/surfacePreset";
import { insertPixelPaletteWidget } from "./pixelCanvas/createPixelWidget";
import {
  persistDashboardLayout,
  hydrateDashboardStyle,
  editorDirtySnapshot,
  editorResetBaselineSnapshot,
  layoutAfterEditorReset,
  layoutForEditorAfterPersist,
} from "./stylePipeline";

describe("data-screen persist bounds", () => {
  it("keeps fixed canvas height when widgets extend below 1080", () => {
    let layout = buildDefaultLayoutForSurface("data-screen");
    layout = insertPixelPaletteWidget("gauge", layout);
    layout = insertPixelPaletteWidget("line", layout);
    const widgets = layout.widgets.map((w) => ({ ...w, y: 900 }));
    layout = { ...layout, widgets };
    const style = hydrateDashboardStyle(layout.styleConfig);
    const saved = persistDashboardLayout(layout, style);
    expect(saved.canvas.height).toBe(1080);
    for (const w of saved.widgets) {
      expect(w.y + w.height).toBeLessThanOrEqual(saved.canvas.height);
      expect(w.x + w.width).toBeLessThanOrEqual(saved.canvas.width);
    }
  });

  it("does not shrink canvas below 1080 when widgets are shorter", () => {
    let layout = buildDefaultLayoutForSurface("data-screen");
    layout = insertPixelPaletteWidget("gauge", layout);
    layout = insertPixelPaletteWidget("line", layout);
    const widgets = layout.widgets.map((w, i) => ({
      ...w,
      x: i === 0 ? 0 : 804,
      y: 0,
      width: i === 0 ? 804 : 768,
      height: 583,
    }));
    layout = { ...layout, widgets };
    const style = hydrateDashboardStyle(layout.styleConfig);
    const saved = persistDashboardLayout(layout, style);
    expect(saved.canvas.height).toBeGreaterThanOrEqual(1080);
    for (const w of saved.widgets) {
      expect(w.y + w.height).toBeLessThanOrEqual(saved.canvas.height);
    }
  });

  it("default insert positions stay within canvas height", () => {
    let layout = buildDefaultLayoutForSurface("data-screen");
    layout = insertPixelPaletteWidget("gauge", layout);
    layout = insertPixelPaletteWidget("line", layout);
    const style = hydrateDashboardStyle(layout.styleConfig);
    const saved = persistDashboardLayout(layout, style);
    expect(saved.canvas.height).toBeGreaterThanOrEqual(1080);
    for (const w of saved.widgets) {
      expect(w.y + w.height).toBeLessThanOrEqual(saved.canvas.height);
    }
  });

  it("editorDirtySnapshot is stable after persist roundtrip", () => {
    let layout = buildDefaultLayoutForSurface("data-screen");
    layout = insertPixelPaletteWidget("gauge", layout);
    const style = hydrateDashboardStyle(layout.styleConfig);
    const before = editorDirtySnapshot(layout, style, true);
    const after = editorDirtySnapshot(
      persistDashboardLayout(layout, style),
      style,
      true,
    );
    expect(after.fingerprint).toBe(before.fingerprint);
  });

  it("preserves widget coordinates after persist roundtrip", () => {
    let layout = buildDefaultLayoutForSurface("data-screen");
    layout = insertPixelPaletteWidget("gauge", layout);
    layout = insertPixelPaletteWidget("line", layout);
    const widgets = layout.widgets.map((w, i) => ({
      ...w,
      x: i === 0 ? 120 : 680,
      y: i === 0 ? 80 : 240,
      width: 480,
      height: 320,
    }));
    layout = { ...layout, widgets };
    const style = hydrateDashboardStyle(layout.styleConfig);
    const saved = persistDashboardLayout(layout, style);
    const editorLayout = layoutForEditorAfterPersist(saved, style);
    for (const original of widgets) {
      const roundtripped = editorLayout.widgets.find((w) => w.id === original.id);
      expect(roundtripped?.x).toBe(original.x);
      expect(roundtripped?.y).toBe(original.y);
      expect(roundtripped?.width).toBe(original.width);
      expect(roundtripped?.height).toBe(original.height);
    }
  });

  it("editorResetBaselineSnapshot matches post-reset dirty state after save", () => {
    let layout = buildDefaultLayoutForSurface("data-screen");
    layout = insertPixelPaletteWidget("gauge", layout);
    layout = insertPixelPaletteWidget("line", layout);
    const style = hydrateDashboardStyle(layout.styleConfig);
    const normalized = persistDashboardLayout(layout, style);
    const savedStyle = hydrateDashboardStyle(normalized.styleConfig);
    const layoutForEditor = layoutForEditorAfterPersist(normalized, savedStyle);
    const baseline = editorResetBaselineSnapshot(layoutForEditor, savedStyle, true);
    const afterReset = layoutAfterEditorReset(
      { ...layoutForEditor, styleConfig: savedStyle },
      true,
    );
    const dirtyAfter = editorDirtySnapshot(
      { ...afterReset, styleConfig: savedStyle },
      savedStyle,
      true,
    );
    expect(dirtyAfter.fingerprint).toBe(baseline.fingerprint);
  });
});
