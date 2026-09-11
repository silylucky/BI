import { describe, expect, it } from "vitest";
import {
  isRichTextEmpty,
  sanitizeRichTextHtml,
  textConfigToHtml,
} from "./richTextHtml";

describe("richTextHtml", () => {
  it("converts plain text to escaped paragraphs", () => {
    expect(
      textConfigToHtml({
        content: "<script>alert(1)</script>\n第二行",
        variant: "plain",
      }),
    ).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p><p>第二行</p>");
  });

  it("normalizes legacy markdown lines without executing HTML", () => {
    expect(
      textConfigToHtml({
        content: "# 标题\n正文",
        variant: "markdown",
      }),
    ).toBe("<p># 标题</p><p>正文</p>");
  });

  it("removes executable markup and unsafe styles", () => {
    const html =
      '<p onclick="alert(1)" style="font-size:16px;background:url(javascript:1);color:red">A</p>' +
      '<script>alert(1)</script><a href="javascript:alert(1)">B</a>';
    const result = sanitizeRichTextHtml(html);
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("<script");
    expect(result).not.toContain("javascript:");
    expect(result).not.toContain("background");
    expect(result).toContain("font-size: 16px");
    expect(result).toContain("color: red");
  });

  it("forces safe attributes for external links", () => {
    const result = sanitizeRichTextHtml(
      '<a href="https://example.com" target="_blank">链接</a>',
    );
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it.each(["", "<p></p>", "<p><br></p>", "<p>&nbsp;</p>"])(
    "treats %s as empty",
    (html) => {
      expect(isRichTextEmpty(html)).toBe(true);
    },
  );

  it("preserves blank lines from TipTap empty paragraphs", () => {
    const fromEditor =
      '<p><br class="ProseMirror-trailingBreak"></p>' +
      '<p><br class="ProseMirror-trailingBreak"></p>' +
      '<p><span style="color: rgb(0, 255, 255)">当月金额</span></p>';
    const result = sanitizeRichTextHtml(fromEditor);
    expect(result.startsWith("<p><br></p><p><br></p>")).toBe(true);
    expect(result).toContain("当月金额");
    expect(result).not.toContain("ProseMirror-trailingBreak");
  });

  it("keeps soft breaks inside a paragraph", () => {
    const result = sanitizeRichTextHtml("<p>第一行<br>第二行</p>");
    expect(result).toBe("<p>第一行<br>第二行</p>");
  });

  it("strips trailingBreak after content without collapsing the paragraph", () => {
    const result = sanitizeRichTextHtml(
      '<p>正文<br class="ProseMirror-trailingBreak"></p>',
    );
    expect(result).toBe("<p>正文</p>");
  });
});
