# Dashboard Rich Text Inline Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用 Tiptap 3 为 Dashboard 富文本 Widget 增加 DataEase 风格的画布内双击编辑、完整基础格式工具栏、安全 HTML 存储及旧内容兼容。

**Architecture:** `TextWidget` 只管理查看/编辑状态，`RichTextEditor` 封装 Tiptap 生命周期，`RichTextToolbar` 映射格式命令，`richTextHtml` 统一负责旧格式转 HTML、净化和空值判断。编辑结果通过现有 `DashboardWidget → DashboardEditPage → setWidgets` 数据流进入 layout 草稿，不新增 API、不升级 layout version。

**Tech Stack:** React 19、TypeScript 5.7、Tiptap 3、ProseMirror、DOMPurify、Tailwind CSS v4、Radix/shadcn、Vitest、Testing Library、FastAPI/Pydantic。

## Global Constraints

- Tiptap 与 DOMPurify 必须使用当前包管理器解析到的最新稳定版，不手写版本号。
- Tiptap 与 DOMPurify 必须保持 MIT 许可证；禁止引入 TinyMCE GPL/商业运行时。
- `TextVariant` 精确扩展为 `"plain" | "markdown" | "html"`。
- HTML 仍保存于 `textConfig.content`，不改变 Dashboard layout version。
- 双击进入编辑；点击组件外或 `Ctrl+Enter` 提交；`Esc` 取消。
- 编辑状态必须阻止 Dashboard 拖拽、缩放和选择切换。
- view 模式不得创建 Tiptap editor 实例。
- 所有 HTML 在显示和提交前均经过白名单净化。
- 不增加协同、评论、AI、图片上传或原始 HTML 编辑入口。
- UI 必须使用现有语义 Token、Button/Select/DropdownMenu，并覆盖 dark、focus-visible、active、disabled。
- 实施过程中不得修改或删除用户现有无关改动。
- 未经用户明确授权不得执行 `git commit`；各 Task 的提交命令仅作为获授权后的可选收口步骤。

## File Map

### Create

- `fe/src/components/dashboard/richTextHtml.ts`：HTML 转换、净化、空值判断。
- `fe/src/components/dashboard/richTextHtml.test.ts`：转换与 XSS 回归。
- `fe/src/components/dashboard/richTextExtensions.ts`：Tiptap 扩展列表与 FontSize 扩展。
- `fe/src/components/dashboard/RichTextToolbar.tsx`：格式工具栏。
- `fe/src/components/dashboard/RichTextEditor.tsx`：编辑器生命周期、提交/取消。
- `fe/src/components/dashboard/RichTextEditor.test.tsx`：编辑生命周期与快捷键。
- `fe/src/components/dashboard/TextWidget.rich-text.test.tsx`：单击/双击/查看态行为。

### Modify

- `fe/package.json`、`pnpm-lock.yaml`：增加 Tiptap 与 DOMPurify。
- `fe/src/components/dashboard/layoutUtils.ts`：增加 `html` variant，默认富文本改为安全 HTML。
- `fe/src/components/dashboard/TextWidget.tsx`：接入双击内联编辑。
- `fe/src/components/dashboard/DashboardWidget.tsx`：透传 `onTextConfigChange`。
- `fe/src/pages/admin/dashboard/DashboardEditPage.tsx`：更新 widget 草稿。
- `fe/src/components/dashboard/TextWidgetInspector.tsx`：替换 textarea 为只读摘要与操作提示。
- `fe/src/pages/admin/dashboard/dashboard.smoke.test.tsx`：保存/刷新与 dirty 状态回归。
- `backend/app/dashboard/schemas.py`：允许 `variant="html"`。
- `tests/test_dash_filter_widget_layout_t2.py`：HTML round-trip 与非法 variant。
- `docs/automate/prd/F07-DASH.md`：补充 DASH-007 富文本内联验收。
- `docs/ui/layout.md`：登记双击、提交与取消规则。
- `fe/src/components/README.md`：登记新组件与工具。

---

### Task 1: 安装开源依赖并建立安全 HTML 边界

**Files:**
- Modify: `fe/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `fe/src/components/dashboard/richTextHtml.ts`
- Create: `fe/src/components/dashboard/richTextHtml.test.ts`
- Modify: `fe/src/components/dashboard/layoutUtils.ts`

**Interfaces:**
- Produces: `textConfigToHtml(config: TextWidgetConfig): string`
- Produces: `sanitizeRichTextHtml(html: string): string`
- Produces: `isRichTextEmpty(html: string): boolean`
- Produces: `TextVariant = "plain" | "markdown" | "html"`

- [ ] **Step 1: 写转换和净化的失败测试**

创建 `richTextHtml.test.ts`：

```ts
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
});
```

- [ ] **Step 2: 运行测试，确认因模块缺失失败**

Run:

```powershell
cd "C:\Users\30381\Desktop\VitalSpan\fe"
pnpm vitest run src/components/dashboard/richTextHtml.test.ts
```

Expected: FAIL，提示无法解析 `./richTextHtml`。

- [ ] **Step 3: 通过包管理器安装最新稳定依赖**

Run:

```powershell
cd "C:\Users\30381\Desktop\VitalSpan\fe"
pnpm add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-text-align @tiptap/extension-text-style @tiptap/extension-color @tiptap/extension-link dompurify
```

Expected: `package.json` 和 `pnpm-lock.yaml` 更新，无 peer dependency 冲突。

随后核对许可证：

```powershell
pnpm licenses list --json
```

Expected: 本 Task 新增包均为 MIT 或其 ProseMirror 兼容许可证；不得出现 GPL/AGPL。

- [ ] **Step 4: 实现类型扩展与 HTML 工具**

在 `layoutUtils.ts` 将类型改为：

```ts
export type TextVariant = "plain" | "markdown" | "html";

export function defaultTextConfig(): TextWidgetConfig {
  return { content: "", variant: "html" };
}
```

创建 `richTextHtml.ts`，接口和白名单必须如下：

```ts
import DOMPurify from "dompurify";
import type { TextWidgetConfig } from "./layoutUtils";

const ALLOWED_TAGS = [
  "p", "br", "h1", "h2", "h3", "h4",
  "strong", "b", "em", "i", "u", "s",
  "ul", "ol", "li", "blockquote", "a", "span",
];

const ALLOWED_STYLE = new Set(["color", "font-size", "text-align"]);

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function linesToParagraphs(value: string): string {
  if (!value) return "";
  return value
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
    .join("");
}

function normalizeStyle(element: HTMLElement): void {
  const next: string[] = [];
  for (const property of ALLOWED_STYLE) {
    const value = element.style.getPropertyValue(property).trim();
    if (value) next.push(`${property}: ${value}`);
  }
  if (next.length) element.setAttribute("style", next.join("; "));
  else element.removeAttribute("style");
}

export function sanitizeRichTextHtml(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "target", "rel", "style"],
    ALLOW_DATA_ATTR: false,
  });
  const document = new DOMParser().parseFromString(clean, "text/html");
  for (const element of document.body.querySelectorAll<HTMLElement>("[style]")) {
    normalizeStyle(element);
  }
  for (const link of document.body.querySelectorAll<HTMLAnchorElement>("a")) {
    const href = link.getAttribute("href")?.trim() ?? "";
    if (!/^(https?:|mailto:|tel:|\/|#)/i.test(href)) link.removeAttribute("href");
    if (link.target === "_blank") link.rel = "noopener noreferrer";
  }
  return document.body.innerHTML;
}

export function textConfigToHtml(config: TextWidgetConfig): string {
  if (config.variant === "html") return sanitizeRichTextHtml(config.content);
  return linesToParagraphs(config.content);
}

export function isRichTextEmpty(html: string): boolean {
  const document = new DOMParser().parseFromString(
    sanitizeRichTextHtml(html),
    "text/html",
  );
  return (document.body.textContent ?? "").replaceAll("\u00a0", " ").trim() === "";
}
```

- [ ] **Step 5: 运行测试并确认通过**

Run:

```powershell
pnpm vitest run src/components/dashboard/richTextHtml.test.ts src/components/dashboard/layoutUtils.test.ts
```

Expected: PASS。

- [ ] **Step 6: 获授权后可选提交**

```powershell
git add fe/package.json pnpm-lock.yaml fe/src/components/dashboard/layoutUtils.ts fe/src/components/dashboard/richTextHtml.ts fe/src/components/dashboard/richTextHtml.test.ts
git commit -m "feat(dashboard): establish safe rich text html boundary"
```

---

### Task 2: 扩展后端 HTML schema 并验证 round-trip

**Files:**
- Modify: `backend/app/dashboard/schemas.py`
- Modify: `tests/test_dash_filter_widget_layout_t2.py`

**Interfaces:**
- Consumes: `variant: "html"` from Task 1.
- Produces: Pydantic accepts and serializes HTML variant without changing content.

- [ ] **Step 1: 写后端失败测试**

在 `test_dash_filter_widget_layout_t2.py` 增加：

```py
def test_text_widget_html_round_trip():
    wid = uuid.uuid4()
    layout = DashboardLayout.model_validate(
        {
            "version": 1,
            "widgets": [
                {
                    "id": str(wid),
                    "type": "text",
                    "title": "说明",
                    "colSpan": 6,
                    "rowSpan": 2,
                    "order": 0,
                    "textConfig": {
                        "content": "<p><strong>重要</strong></p>",
                        "variant": "html",
                    },
                }
            ],
            "globalFilters": [],
        }
    )
    dumped = layout.model_dump(by_alias=True, mode="json")
    assert dumped["widgets"][0]["textConfig"]["variant"] == "html"
    assert DashboardLayout.model_validate(dumped).widgets[0].text_config.content == (
        "<p><strong>重要</strong></p>"
    )


def test_text_widget_rejects_unknown_variant():
    with pytest.raises(ValidationError):
        TextWidgetConfig.model_validate({"content": "x", "variant": "wysiwyg"})
```

同时导入：

```py
import pytest
from pydantic import ValidationError
from app.dashboard.schemas import TextWidgetConfig
```

- [ ] **Step 2: 运行测试并确认 html 被拒绝**

Run:

```powershell
cd "C:\Users\30381\Desktop\VitalSpan\backend"
python -m pytest ../tests/test_dash_filter_widget_layout_t2.py -q
```

Expected: `test_text_widget_html_round_trip` FAIL，`html` 不属于允许值。

- [ ] **Step 3: 扩展后端联合类型**

在 `backend/app/dashboard/schemas.py`：

```py
TextVariant = Literal["markdown", "plain", "html"]
```

不修改 `TextWidgetConfig.content` 的 `max_length=8000`。

- [ ] **Step 4: 运行测试并确认通过**

Run:

```powershell
python -m pytest ../tests/test_dash_filter_widget_layout_t2.py -q
```

Expected: 全部 PASS。

- [ ] **Step 5: 获授权后可选提交**

```powershell
git add backend/app/dashboard/schemas.py tests/test_dash_filter_widget_layout_t2.py
git commit -m "feat(dashboard): support html text widgets"
```

---

### Task 3: 建立 Tiptap 扩展、工具栏和编辑生命周期

**Files:**
- Create: `fe/src/components/dashboard/richTextExtensions.ts`
- Create: `fe/src/components/dashboard/RichTextToolbar.tsx`
- Create: `fe/src/components/dashboard/RichTextEditor.tsx`
- Create: `fe/src/components/dashboard/RichTextEditor.test.tsx`

**Interfaces:**
- Consumes: `sanitizeRichTextHtml(html: string): string`.
- Produces:

```ts
type RichTextEditorProps = {
  initialHtml: string;
  onCommit: (html: string) => void;
  onCancel: () => void;
};
```

- [ ] **Step 1: 写编辑生命周期失败测试**

测试必须 mock Tiptap 的 DOM 行为边界，而不 mock `TextWidget`：

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "./RichTextEditor";

describe("RichTextEditor", () => {
  it("commits sanitized html with Ctrl+Enter", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <RichTextEditor
        initialHtml="<p>初始</p>"
        onCommit={onCommit}
        onCancel={vi.fn()}
      />,
    );
    const editor = await screen.findByRole("textbox", { name: "富文本内容" });
    await user.click(editor);
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(onCommit).toHaveBeenCalledWith("<p>初始</p>");
  });

  it("cancels with Escape without committing", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <RichTextEditor
        initialHtml="<p>初始</p>"
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("stops pointer events from reaching dashboard drag surface", async () => {
    const parentPointerDown = vi.fn();
    const user = userEvent.setup();
    render(
      <div onPointerDown={parentPointerDown}>
        <RichTextEditor
          initialHtml="<p>初始</p>"
          onCommit={vi.fn()}
          onCancel={vi.fn()}
        />
      </div>,
    );
    await user.click(await screen.findByRole("textbox", { name: "富文本内容" }));
    expect(parentPointerDown).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试并确认组件缺失**

Run:

```powershell
cd "C:\Users\30381\Desktop\VitalSpan\fe"
pnpm vitest run src/components/dashboard/RichTextEditor.test.tsx
```

Expected: FAIL，无法解析 `./RichTextEditor`。

- [ ] **Step 3: 创建 FontSize 和 Tiptap 扩展**

`richTextExtensions.ts` 对外导出：

```ts
import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [{
      types: ["textStyle"],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element) => element.style.fontSize || null,
          renderHTML: (attributes) =>
            attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

export const richTextExtensions = [
  StarterKit,
  Underline,
  TextStyle,
  Color,
  FontSize,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    HTMLAttributes: { rel: "noopener noreferrer" },
  }),
];
```

- [ ] **Step 4: 创建工具栏**

`RichTextToolbar.tsx` 必须接收 `editor: Editor`，使用现有 `Button`、`Select`
和 lucide 图标，命令映射如下：

```ts
editor.chain().focus().undo().run();
editor.chain().focus().redo().run();
editor.chain().focus().setParagraph().run();
editor.chain().focus().toggleHeading({ level: 1 }).run();
editor.chain().focus().toggleBold().run();
editor.chain().focus().toggleItalic().run();
editor.chain().focus().toggleUnderline().run();
editor.chain().focus().setColor(color).run();
editor.chain().focus().setTextAlign("center").run();
editor.chain().focus().toggleBulletList().run();
editor.chain().focus().toggleOrderedList().run();
editor.chain().focus().unsetAllMarks().clearNodes().run();
```

链接按钮通过 `window.prompt("输入链接地址")` 获取值；空值执行 `unsetLink()`，
非空值执行 `setLink({ href, target: "_blank" })`。所有按钮添加中文
`aria-label`，disabled 由 `editor.can().chain()` 推导。

- [ ] **Step 5: 创建编辑器组件**

核心生命周期必须精确采用：

```tsx
export function RichTextEditor({
  initialHtml,
  onCommit,
  onCancel,
}: RichTextEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const editor = useEditor({
    extensions: richTextExtensions,
    content: initialHtml,
    autofocus: "end",
    editorProps: {
      attributes: {
        class:
          "rich-main-class min-h-full outline-none text-theme-sm text-gray-700 dark:text-gray-300",
        "aria-label": "富文本内容",
      },
    },
  });

  const commit = useCallback(() => {
    if (!editor) return;
    onCommit(sanitizeRichTextHtml(editor.getHTML()));
  }, [editor, onCommit]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) commit();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [commit]);

  if (!editor) return null;

  return (
    <div
      ref={rootRef}
      className="dashboard-no-drag flex h-full min-h-0 flex-col"
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        } else if (event.key === "Enter" && event.ctrlKey) {
          event.preventDefault();
          commit();
        }
      }}
    >
      <RichTextToolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="min-h-0 flex-1 overflow-auto p-3"
      />
    </div>
  );
}
```

outside pointer 必须避免工具栏点击先提交；工具栏位于 `rootRef` 内即可满足。

- [ ] **Step 6: 运行编辑器测试并确认通过**

Run:

```powershell
pnpm vitest run src/components/dashboard/RichTextEditor.test.tsx
```

Expected: PASS，无 React act warning。

- [ ] **Step 7: 获授权后可选提交**

```powershell
git add fe/src/components/dashboard/richTextExtensions.ts fe/src/components/dashboard/RichTextToolbar.tsx fe/src/components/dashboard/RichTextEditor.tsx fe/src/components/dashboard/RichTextEditor.test.tsx
git commit -m "feat(dashboard): add tiptap inline editor"
```

---

### Task 4: 将双击编辑接入 TextWidget

**Files:**
- Create: `fe/src/components/dashboard/TextWidget.rich-text.test.tsx`
- Modify: `fe/src/components/dashboard/TextWidget.tsx`

**Interfaces:**
- Consumes: `RichTextEditor`, `textConfigToHtml`, `isRichTextEmpty`.
- Produces:

```ts
onTextConfigChange?: (id: string, config: TextWidgetConfig) => void;
```

- [ ] **Step 1: 写 TextWidget 失败测试**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TextWidget } from "./TextWidget";
import type { LayoutWidget, TextWidgetConfig } from "./layoutUtils";

const widget = {
  id: "text-1",
  type: "text",
  title: "说明",
  colSpan: 6,
  rowSpan: 2,
  order: 0,
  textConfig: { content: "<p>旧内容</p>", variant: "html" },
} satisfies LayoutWidget & { textConfig: TextWidgetConfig };

describe("TextWidget inline editing", () => {
  it("single click selects but double click opens editor", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <TextWidget
        widget={widget}
        mode="edit"
        onSelect={onSelect}
        onTextConfigChange={vi.fn()}
      />,
    );
    const content = screen.getByTestId("text-widget-content");
    await user.click(content);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("textbox", { name: "富文本内容" })).toBeNull();
    await user.dblClick(content);
    expect(await screen.findByRole("textbox", { name: "富文本内容" })).toBeVisible();
  });

  it("shows a non-persistent placeholder for empty content", () => {
    render(
      <TextWidget
        widget={{ ...widget, textConfig: { content: "", variant: "html" } }}
        mode="edit"
      />,
    );
    expect(screen.getByText("双击编辑文字")).toBeVisible();
  });

  it("never creates an editor in view mode", () => {
    render(<TextWidget widget={widget} mode="view" />);
    expect(screen.getByText("旧内容")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "富文本内容" })).toBeNull();
  });
});
```

- [ ] **Step 2: 运行并确认双击测试失败**

Run:

```powershell
pnpm vitest run src/components/dashboard/TextWidget.rich-text.test.tsx
```

Expected: FAIL，找不到 `text-widget-content` 或富文本 textbox。

- [ ] **Step 3: 实现 TextWidget 状态机**

在 `TextWidgetProps` 增加：

```ts
onTextConfigChange?: (id: string, config: TextWidgetConfig) => void;
```

在组件内增加：

```ts
const [isEditing, setIsEditing] = useState(false);
const initialConfigRef = useRef(widget.textConfig);
const html = textConfigToHtml(widget.textConfig);

const beginEditing = () => {
  if (mode !== "edit") return;
  initialConfigRef.current = widget.textConfig;
  onSelect?.();
  setIsEditing(true);
};

const commit = (nextHtml: string) => {
  onTextConfigChange?.(widget.id, {
    content: isRichTextEmpty(nextHtml) ? "" : nextHtml,
    variant: "html",
  });
  setIsEditing(false);
};

const cancel = () => {
  setIsEditing(false);
};
```

正文区域改为：

```tsx
<div
  data-testid="text-widget-content"
  role={mode === "edit" && !isEditing ? "button" : undefined}
  tabIndex={mode === "edit" && !isEditing ? 0 : undefined}
  onClick={
    mode === "edit" && !isEditing
      ? (event) => {
          event.stopPropagation();
          onSelect?.();
        }
      : undefined
  }
  onDoubleClick={(event) => {
    event.stopPropagation();
    beginEditing();
  }}
  className="dashboard-no-drag min-h-0 flex-1 overflow-auto"
>
  {isEditing ? (
    <RichTextEditor initialHtml={html} onCommit={commit} onCancel={cancel} />
  ) : isRichTextEmpty(html) ? (
    <p className="flex h-full items-center justify-center p-3 text-theme-sm text-gray-400">
      双击编辑文字
    </p>
  ) : (
    <div
      className="rich-main-class p-3 text-theme-sm text-gray-700 dark:text-gray-300"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )}
</div>
```

取消时不调用 `onTextConfigChange`，因此自动保持进入编辑前配置。

- [ ] **Step 4: 运行测试并确认通过**

Run:

```powershell
pnpm vitest run src/components/dashboard/TextWidget.rich-text.test.tsx
```

Expected: PASS。

- [ ] **Step 5: 获授权后可选提交**

```powershell
git add fe/src/components/dashboard/TextWidget.tsx fe/src/components/dashboard/TextWidget.rich-text.test.tsx
git commit -m "feat(dashboard): enable double-click text editing"
```

---

### Task 5: 接入 Dashboard 草稿、撤销栈和右栏提示

**Files:**
- Modify: `fe/src/components/dashboard/DashboardWidget.tsx`
- Modify: `fe/src/pages/admin/dashboard/DashboardEditPage.tsx`
- Modify: `fe/src/components/dashboard/TextWidgetInspector.tsx`
- Modify: `fe/src/pages/admin/dashboard/dashboard.smoke.test.tsx`

**Interfaces:**
- Consumes: `onTextConfigChange(id, config)` from Task 4.
- Produces: 富文本提交进入现有 `setWidgets`、dirty fingerprint 和 undo/redo。

- [ ] **Step 1: 写页面草稿失败测试**

在 `dashboard.smoke.test.tsx` 增加：

```tsx
it("T-DASH-RICH-01: inline text commit marks layout dirty and is saved", async () => {
  const user = userEvent.setup();
  mockDashboardLoad([
    {
      id: "text-1",
      type: "text",
      title: "说明",
      colSpan: 6,
      rowSpan: 2,
      order: 0,
      textConfig: { content: "<p>旧内容</p>", variant: "html" },
    },
  ]);
  renderEditPage();
  const content = await screen.findByTestId("text-widget-content");
  await user.dblClick(content);
  const editor = await screen.findByRole("textbox", { name: "富文本内容" });
  await user.click(editor);
  await user.keyboard("{Control>}{Enter}{/Control}");
  expect(screen.getByRole("button", { name: "保存布局" })).toBeEnabled();
});
```

- [ ] **Step 2: 运行并确认回调未接入导致失败**

Run:

```powershell
pnpm vitest run src/pages/admin/dashboard/dashboard.smoke.test.tsx -t "T-DASH-RICH-01"
```

Expected: FAIL，保存按钮仍为 disabled 或内容回调不存在。

- [ ] **Step 3: 透传并更新配置**

`DashboardWidgetProps` 增加：

```ts
onTextConfigChange?: (id: string, config: TextWidgetConfig) => void;
```

传给 `TextWidget`：

```tsx
onTextConfigChange={onTextConfigChange}
```

`DashboardEditPage` 的顶层和 Tab 子组件渲染均传：

```tsx
onTextConfigChange={(wid, textConfig) =>
  setWidgets((prev) =>
    prev.map((item) =>
      item.id === wid ? { ...item, textConfig } : item,
    ),
  )
}
```

这必须复用现有 `useLayoutHistory` 的 `setWidgets`，禁止直接修改数组，保证
undo/redo 与 dirty fingerprint 正常工作。

- [ ] **Step 4: 将 Inspector 改为只读提示**

`TextWidgetInspector.tsx` 删除 textarea 和 variant Select，改为：

```tsx
export function TextWidgetInspector({
  widget,
  embedded = false,
}: TextWidgetInspectorProps) {
  const html = textConfigToHtml(widget.textConfig);
  const document = new DOMParser().parseFromString(html, "text/html");
  const characters = (document.body.textContent ?? "").trim().length;
  const body = (
    <div className="space-y-3 p-4">
      <div className="rounded-lg border border-brand-100 bg-brand-50/60 p-3 dark:border-brand-500/20 dark:bg-brand-500/10">
        <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
          双击画布中的文字进行编辑
        </p>
        <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
          点击外部或 Ctrl+Enter 保存，Esc 取消。
        </p>
      </div>
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        当前内容：{characters} 个字符
      </p>
    </div>
  );
  if (embedded) return body;
  return <div className="rounded-xl border border-gray-200 dark:border-gray-800">{body}</div>;
}
```

同步从 props 删除未使用的 `onChange`，并删除 `DashboardEditPage` 的该回调。

- [ ] **Step 5: 运行页面和组件回归**

Run:

```powershell
pnpm vitest run src/components/dashboard/RichTextEditor.test.tsx src/components/dashboard/TextWidget.rich-text.test.tsx src/pages/admin/dashboard/dashboard.smoke.test.tsx
```

Expected: PASS。

- [ ] **Step 6: 获授权后可选提交**

```powershell
git add fe/src/components/dashboard/DashboardWidget.tsx fe/src/pages/admin/dashboard/DashboardEditPage.tsx fe/src/components/dashboard/TextWidgetInspector.tsx fe/src/pages/admin/dashboard/dashboard.smoke.test.tsx
git commit -m "feat(dashboard): persist inline rich text drafts"
```

---

### Task 6: 文档同步、整体验证和视觉验收

**Files:**
- Modify: `docs/automate/prd/F07-DASH.md`
- Modify: `docs/ui/layout.md`
- Modify: `fe/src/components/README.md`

**Interfaces:**
- Consumes: 已通过 Task 1–5 的实现和测试。
- Produces: 可审计 PRD 验收条款与完成证据。

- [ ] **Step 1: 同步 PRD 验收**

在 DASH-007 富文本条目明确补充：

```md
- [x] DASH-007-03A：富文本 Widget 使用 Tiptap 3；画布双击内联编辑
- [x] DASH-007-03B：HTML 白名单净化；旧 plain/markdown 可读并在编辑提交后升级
- [x] DASH-007-03C：点击外部/Ctrl+Enter 提交，Esc 取消；编辑时不触发画布拖拽
```

- [ ] **Step 2: 同步 UI IA 与组件索引**

`docs/ui/layout.md` 登记：

```md
| 富文本正文 | 单击选中；双击进入内联编辑；点击外部或 Ctrl+Enter 提交；Esc 取消 |
```

`fe/src/components/README.md` 登记：

```md
| RichTextEditor / RichTextToolbar | `dashboard/RichTextEditor.tsx` · `RichTextToolbar.tsx` | Tiptap 3 富文本画布内联编辑 |
| richTextHtml | `dashboard/richTextHtml.ts` | 旧格式转 HTML、白名单净化与空值判断 |
```

- [ ] **Step 3: 运行前端完整相关验证**

Run:

```powershell
cd "C:\Users\30381\Desktop\VitalSpan\fe"
pnpm vitest run src/components/dashboard/richTextHtml.test.ts src/components/dashboard/RichTextEditor.test.tsx src/components/dashboard/TextWidget.rich-text.test.tsx src/components/dashboard/layoutUtils.test.ts src/pages/admin/dashboard/dashboard.smoke.test.tsx
pnpm build
```

Expected: 测试全部 PASS；TypeScript 和 Vite build exit code 0。

- [ ] **Step 4: 运行后端 schema 回归**

Run:

```powershell
cd "C:\Users\30381\Desktop\VitalSpan\backend"
python -m pytest ../tests/test_dash_filter_widget_layout_t2.py ../tests/test_dashboard_pixel_layout.py -q
```

Expected: 全部 PASS。

- [ ] **Step 5: 浏览器交互和截图验收**

启动已有前后端服务前先确认终端中没有重复服务。打开
`/admin/dashboards/:id/edit`，依次验证：

1. 新增富文本，空态显示“​​双击编辑文字”。
2. 单击只选中，双击进入编辑并显示工具栏。
3. 设置粗体、字号、颜色、对齐、列表和链接。
4. 点击外部提交；撤销后重做；`Esc` 取消一次修改。
5. 编辑器内拖动鼠标选字时，组件位置不变化。
6. 保存布局并刷新，HTML 格式保持。
7. view 模式无工具栏且链接安全打开。
8. desktop 1440px、tablet 768px；light/dark 截图无裁切、遮挡、溢出。

Expected: 所有步骤通过；若出现布局问题，结论必须为 fail 或
pass-with-concerns，修复后重新截图。

- [ ] **Step 6: 检查本轮 diff 与文档同步**

Run:

```powershell
cd "C:\Users\30381\Desktop\VitalSpan"
git status --short
git diff --check
```

Expected: 无 whitespace error；无凭证、构建产物或无关文件进入 diff。

- [ ] **Step 7: 获授权后可选提交**

```powershell
git add docs/automate/prd/F07-DASH.md docs/ui/layout.md fe/src/components/README.md
git commit -m "docs(dashboard): document inline rich text editing"
```

---

## Self-Review Result

- Spec coverage：双击编辑、Tiptap 选型、HTML 存储、旧格式兼容、提交/取消、
  画布事件隔离、XSS、测试、浏览器截图和文档同步均有对应 Task。
- Placeholder scan：未发现占位语句或未定义接口。
- Type consistency：`TextVariant`、`TextWidgetConfig`、`onTextConfigChange`、
  `sanitizeRichTextHtml`、`textConfigToHtml` 在所有 Task 中签名一致。
- Scope：未加入协同、上传、新 API 或 layout version 迁移。

