import DOMPurify from "dompurify";
import type { TextWidgetConfig } from "./layoutUtils";

const RICH_TEXT_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "span",
  "a",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "blockquote",
] as const;

const RICH_TEXT_ALLOWED_ATTR = [
  "href",
  "target",
  "rel",
  "style",
  "class",
  "data-text-align",
] as const;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plainLinesToHtml(content: string): string {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0 || (lines.length === 1 && lines[0] === "")) {
    return "";
  }
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

export function textConfigToHtml(config: TextWidgetConfig): string {
  if (config.variant === "html") {
    return sanitizeRichTextHtml(config.content);
  }
  return plainLinesToHtml(config.content);
}

const SAFE_STYLE_PROPS = new Set([
  "font-size",
  "line-height",
  "font-family",
  "color",
  "background-color",
  "text-align",
  "font-weight",
  "font-style",
  "text-decoration",
]);

function sanitizeInlineStyle(style: string): string {
  const parts = style
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const safe: string[] = [];
  for (const part of parts) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    const prop = part.slice(0, colon).trim().toLowerCase();
    const value = part.slice(colon + 1).trim();
    if (!SAFE_STYLE_PROPS.has(prop)) continue;
    if (/javascript:|expression\s*\(/i.test(value)) continue;
    safe.push(`${prop}: ${value}`);
  }
  return safe.join("; ");
}

function hardenRichTextDom(doc: Document): void {
  doc.querySelectorAll("[style]").forEach((node) => {
    const style = node.getAttribute("style");
    if (!style) return;
    const cleaned = sanitizeInlineStyle(style);
    if (cleaned) {
      node.setAttribute("style", cleaned);
    } else {
      node.removeAttribute("style");
    }
  });

  doc.querySelectorAll("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href") ?? "";
    if (/^javascript:/i.test(href)) {
      anchor.removeAttribute("href");
      return;
    }
    if (/^https?:\/\//i.test(href)) {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
    }
  });
}

export function sanitizeRichTextHtml(html: string): string {
  const cleaned = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...RICH_TEXT_ALLOWED_TAGS],
    ALLOWED_ATTR: [...RICH_TEXT_ALLOWED_ATTR],
    ALLOW_DATA_ATTR: true,
  });

  if (!cleaned.trim()) {
    return "";
  }

  const doc = new DOMParser().parseFromString(cleaned, "text/html");
  hardenRichTextDom(doc);

  return stripEditorArtifacts(doc.body.innerHTML);
}

/**
 * TipTap 空段落地为 `<p><br class="ProseMirror-trailingBreak"></p>`。
 * 去掉编辑器标记后须保留 `<p><br></p>`，否则空 `<p></p>` 在 margin:0 下高度为 0，换行丢失。
 */
function stripEditorArtifacts(html: string): string {
  const withoutMarkers = html.replace(
    /<br class="ProseMirror-trailingBreak"\s*\/?>/gi,
    "",
  );
  return withoutMarkers.replace(/<p(\s[^>]*)?>\s*<\/p>/gi, "<p$1><br></p>");
}

export function isRichTextEmpty(html: string): boolean {
  const normalized = sanitizeRichTextHtml(html)
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, "")
    .trim();
  return normalized.length === 0;
}
