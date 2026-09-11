import { describe, expect, it } from "vitest";
import { isRichTextEditorSurface } from "./richTextEditorSession";

describe("richTextEditorSession", () => {
  it("detects portaled toolbar surfaces", () => {
    const menu = document.createElement("div");
    menu.setAttribute("data-rich-text-editor-surface", "");
    const item = document.createElement("button");
    menu.appendChild(item);
    document.body.appendChild(menu);

    expect(isRichTextEditorSurface(item)).toBe(true);

    document.body.removeChild(menu);
  });
});
