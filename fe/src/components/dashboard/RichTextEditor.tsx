import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { RichTextFloatingToolbar } from "./RichTextFloatingToolbar";
import { richTextExtensions } from "./richTextExtensions";
import {
  RICH_TEXT_DEFAULT_FONT_FAMILY,
  RICH_TEXT_DEFAULT_FONT_SIZE,
  shouldIgnoreOutsidePointerForRichText,
} from "./richTextEditorSession";
import { sanitizeRichTextHtml } from "./richTextHtml";

export type RichTextEditorProps = {
  initialHtml: string;
  anchorRef: RefObject<HTMLElement | null>;
  inset?: "none" | "comfortable";
  onCommit: (html: string) => void;
  onCancel: () => void;
};

function applyDefaultTypingStyle(editor: Editor) {
  const { fontSize, fontFamily } = editor.getAttributes("textStyle");
  if (fontSize && fontFamily) return;
  editor
    .chain()
    .setMark("textStyle", {
      fontSize: fontSize ?? RICH_TEXT_DEFAULT_FONT_SIZE,
      fontFamily: fontFamily ?? RICH_TEXT_DEFAULT_FONT_FAMILY,
    })
    .run();
}

export function RichTextEditor({
  initialHtml,
  anchorRef,
  inset = "comfortable",
  onCommit,
  onCancel,
}: RichTextEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const onCommitRef = useRef(onCommit);
  const onCancelRef = useRef(onCancel);
  onCommitRef.current = onCommit;
  onCancelRef.current = onCancel;

  const editor = useEditor({
    extensions: richTextExtensions,
    content: initialHtml,
    autofocus: "end",
    onCreate: ({ editor: created }) => {
      applyDefaultTypingStyle(created);
    },
    editorProps: {
      attributes: {
        class: "rich-main-class min-h-[4rem] outline-none text-gray-800 dark:text-gray-200",
        role: "textbox",
        "aria-label": "富文本内容",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancelRef.current();
          return true;
        }
        if (event.key === "Enter" && event.ctrlKey) {
          event.preventDefault();
          const current = editorRef.current;
          if (current) {
            onCommitRef.current(sanitizeRichTextHtml(current.getHTML()));
          }
          return true;
        }
        return false;
      },
    },
  });

  editorRef.current = editor;

  const commit = useCallback(() => {
    const current = editorRef.current;
    if (!current) return;
    onCommitRef.current(sanitizeRichTextHtml(current.getHTML()));
  }, []);

  useEffect(() => {
    if (!editor) return;
    const onFocus = () => applyDefaultTypingStyle(editor);
    editor.on("focus", onFocus);
    return () => {
      editor.off("focus", onFocus);
    };
  }, [editor]);

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        shouldIgnoreOutsidePointerForRichText(target, {
          editorRoot: rootRef.current,
          toolbarRoot: toolbarRef.current,
          anchorRoot: anchorRef.current,
        })
      ) {
        return;
      }
      commit();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [anchorRef, commit]);

  if (!editor) return null;

  return (
    <>
      <div
        ref={rootRef}
        className="dashboard-no-drag flex h-full min-h-0 flex-col"
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <EditorContent
          editor={editor}
          className={cn(
            "dashboard-scroll min-h-0 flex-1 overflow-auto [&_.ProseMirror]:min-h-[3rem]",
            inset === "comfortable" && "p-4",
          )}
        />
      </div>
      <RichTextFloatingToolbar editor={editor} anchorRef={anchorRef} toolbarRef={toolbarRef} />
    </>
  );
}
