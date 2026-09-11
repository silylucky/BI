import { useLayoutEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { RichTextToolbar } from "./RichTextToolbar";
import { RichTextThemeContext, resolveRichTextToolbarTheme } from "./richTextToolbarTheme";

type RichTextFloatingToolbarProps = {
  editor: Editor;
  anchorRef: RefObject<HTMLElement | null>;
  toolbarRef: RefObject<HTMLDivElement | null>;
};

export type FloatingCoords = { left: number; top: number };

export type ToolbarClampRect = Pick<DOMRect, "left" | "right" | "top" | "bottom">;

const ESTIMATED_WIDTH = 560;
const ESTIMATED_HEIGHT = 38;
const VIEWPORT_MARGIN = 12;
const ANCHOR_GAP = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** 将浮动工具栏限制在画布列内，避免伸入右侧 432px 配置栏 */
export function resolveToolbarClampRect(anchor: HTMLElement | null): ToolbarClampRect {
  const canvas = anchor?.closest(".dashboard-canvas-surface") as HTMLElement | null;
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }
  return {
    left: VIEWPORT_MARGIN,
    right: window.innerWidth - VIEWPORT_MARGIN,
    top: VIEWPORT_MARGIN,
    bottom: window.innerHeight - VIEWPORT_MARGIN,
  };
}

/** 优先贴在锚点上方、左对齐；空间不足时改放下方 */
export function measureFloatingToolbarPosition(
  anchor: DOMRect,
  toolbarWidth: number,
  toolbarHeight: number,
  bounds: ToolbarClampRect = {
    left: VIEWPORT_MARGIN,
    right: window.innerWidth - VIEWPORT_MARGIN,
    top: VIEWPORT_MARGIN,
    bottom: window.innerHeight - VIEWPORT_MARGIN,
  },
): FloatingCoords {
  const minLeft = bounds.left + VIEWPORT_MARGIN;
  const maxLeft = bounds.right - toolbarWidth - VIEWPORT_MARGIN;

  let left = anchor.left;
  if (left + toolbarWidth > bounds.right - VIEWPORT_MARGIN) {
    left = Math.max(minLeft, anchor.right - toolbarWidth);
  }
  left = clamp(left, minLeft, Math.max(minLeft, maxLeft));

  let top = anchor.top - ANCHOR_GAP - toolbarHeight;
  const minTop = bounds.top + VIEWPORT_MARGIN;
  const maxTop = bounds.bottom - toolbarHeight - VIEWPORT_MARGIN;
  if (top < minTop) {
    top = anchor.bottom + ANCHOR_GAP;
  }
  top = clamp(top, minTop, Math.max(minTop, maxTop));

  return { left, top };
}

export function RichTextFloatingToolbar({
  editor,
  anchorRef,
  toolbarRef,
}: RichTextFloatingToolbarProps) {
  const [coords, setCoords] = useState<FloatingCoords>({ left: 0, top: 0 });
  const [maxWidth, setMaxWidth] = useState<number | undefined>();
  const [theme, setTheme] = useState(() => resolveRichTextToolbarTheme(null));

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const bounds = resolveToolbarClampRect(anchor);
      const boundsMaxWidth = Math.max(160, bounds.right - bounds.left - VIEWPORT_MARGIN * 2);
      const toolbarWidth = toolbarRef.current?.offsetWidth ?? ESTIMATED_WIDTH;
      const toolbarHeight = toolbarRef.current?.offsetHeight ?? ESTIMATED_HEIGHT;
      setMaxWidth(boundsMaxWidth);
      setCoords(
        measureFloatingToolbarPosition(
          rect,
          Math.min(toolbarWidth, boundsMaxWidth),
          toolbarHeight,
          bounds,
        ),
      );
      setTheme(resolveRichTextToolbarTheme(anchor));
    };

    update();
    const raf = window.requestAnimationFrame(update);

    const observer = new ResizeObserver(update);
    observer.observe(anchor);
    if (toolbarRef.current) observer.observe(toolbarRef.current);

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, toolbarRef, editor]);

  return createPortal(
    <RichTextThemeContext.Provider value={theme}>
      <div
        className={cn("pointer-events-none fixed inset-0 z-99999", theme.className)}
        style={theme.style}
      >
        <RichTextToolbar
          ref={toolbarRef}
          editor={editor}
          density="compact"
          floating
          className="pointer-events-auto fixed"
          style={{ left: coords.left, top: coords.top, maxWidth }}
          data-testid="rich-text-floating-toolbar"
        />
      </div>
    </RichTextThemeContext.Provider>,
    document.body,
  );
}
