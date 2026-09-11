import type { CSSProperties } from "react";

export const RICH_TEXT_FONT_SIZES = [
  "12px",
  "14px",
  "16px",
  "18px",
  "20px",
  "24px",
  "28px",
  "32px",
  "36px",
  "42px",
  "48px",
  "56px",
  "64px",
  "72px",
  "96px",
  "108px",
  "120px",
  "144px",
  "168px",
  "192px",
] as const;

export const RICH_TEXT_DEFAULT_FONT_SIZE = "32px";
export const RICH_TEXT_DEFAULT_FONT_FAMILY = "SimSun, serif";

export const RICH_TEXT_EDITOR_SURFACE_ATTR = "data-rich-text-editor-surface";

export const richTextEditorSurfaceProps = {
  [RICH_TEXT_EDITOR_SURFACE_ATTR]: "",
} as const;

/** portal 到 body 的下拉/取色浮层：跟随看板 --dashboard-* 令牌 */
export const richTextOverlayContentClass = [
  "z-99999",
  "border-[color:var(--dashboard-widget-border,#e4e7ec)]",
  "bg-[var(--dashboard-dialog-bg,#ffffff)]",
  "text-[color:var(--dashboard-text-primary,#344054)]",
  // DropdownMenuItem / SelectItem 自带 gray 色会盖掉继承色，暗色看板下需强制跟令牌
  "[&_[role=menuitem]]:!text-[color:var(--dashboard-text-primary,#344054)]",
  "[&_[role=menuitem]]:focus:bg-white/10 [&_[role=menuitem]]:data-[highlighted]:bg-white/10",
  "[&_[role=menuitem]_svg]:!text-[color:var(--dashboard-text-primary,#344054)]",
  "[&_[role=option]]:!text-[color:var(--dashboard-text-primary,#344054)]",
  "[&_[role=option]]:focus:bg-white/10 [&_[role=option]]:data-[highlighted]:bg-white/10",
].join(" ");

export function buildRichTextOverlayProps(themeStyle?: CSSProperties, extraClassName?: string) {
  return {
    ...richTextEditorSurfaceProps,
    className: extraClassName
      ? `${richTextOverlayContentClass} ${extraClassName}`
      : richTextOverlayContentClass,
    style: themeStyle,
  };
}

export function isRichTextEditorSurface(target: Node | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(`[${RICH_TEXT_EDITOR_SURFACE_ATTR}]`) !== null;
}

export function shouldIgnoreOutsidePointerForRichText(
  target: Node,
  roots: {
    editorRoot?: HTMLElement | null;
    toolbarRoot?: HTMLElement | null;
    anchorRoot?: HTMLElement | null;
  },
): boolean {
  if (roots.editorRoot?.contains(target)) return true;
  if (roots.toolbarRoot?.contains(target)) return true;
  if (roots.anchorRoot?.contains(target)) return true;
  return isRichTextEditorSurface(target);
}
