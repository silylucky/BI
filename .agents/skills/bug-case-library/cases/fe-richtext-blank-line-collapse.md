# 富文本空行换行折叠

- **ID**: CASE-2026-08-07-001
- **状态**: 已修复
- **影响**: fe
- **首次发现**: 2026-08-07

## 症状

- 数据大屏/看板文本组件中按 Enter 插入空行（把正文下推）后，编辑态可见光标与正文之间有空隙
- 退出编辑 / 保存后空行消失，换行「不生效」

## 根因

- TipTap 空段落 HTML 为 `<p><br class="ProseMirror-trailingBreak"></p>`
- `stripEditorArtifacts` 去掉 `ProseMirror-trailingBreak` 后，又把所有 `</p>` 前的 `<br>` 剥掉，得到 `<p></p>`
- `.rich-main-class p { margin: 0 }` 下空段落高度为 0，垂直空白丢失

## 错误做法（避免）

- 用全局正则 `/<br\s*\/?>\s*<\/p>/gi` → `</p>` 清理编辑器产物（会误伤空行占位 `<br>`）

## 修复方式

- `fe/src/components/dashboard/richTextHtml.ts`：去掉 trailingBreak 后，将空 `<p></p>` 规范为 `<p><br></p>`，保留行高
- `fe/src/index.css`：`p:empty::before` 兜底，防止漏网空段折叠

## 验证

- 单测：`richTextHtml.test.ts`「preserves blank lines from TipTap empty paragraphs」
- 手测：文本组件顶部连按 Enter → 退出编辑 → 空行仍在；刷新后仍在

## 关联

- `RichTextEditor.tsx` · `TextWidget.tsx` · `sanitizeRichTextHtml`
