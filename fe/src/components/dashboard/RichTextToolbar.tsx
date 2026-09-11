import { forwardRef, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import type { ChainedCommands, Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Eraser,
  Italic,
  Link2,
  List,
  ListOrdered,
  MoreHorizontal,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { ColorField } from "@/components/ui/color-field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  HIGHLIGHT_COLOR_RECOMMENDED,
  TEXT_COLOR_RECOMMENDED,
} from "./dashboardStyleConfig";
import {
  RICH_TEXT_DEFAULT_FONT_SIZE,
  RICH_TEXT_FONT_SIZES,
  buildRichTextOverlayProps,
  richTextEditorSurfaceProps,
} from "./richTextEditorSession";
import { useRichTextTheme } from "./richTextToolbarTheme";

const FONT_FAMILIES = [
  { label: "宋体", value: "SimSun, serif" },
  { label: "黑体", value: "SimHei, sans-serif" },
  { label: "微软雅黑", value: "Microsoft YaHei, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
] as const;

type RichTextToolbarProps = {
  editor: Editor;
  className?: string;
  style?: CSSProperties;
  density?: "compact" | "comfortable";
  floating?: boolean;
  "data-testid"?: string;
};

function Divider({ tall }: { tall?: boolean }) {
  return (
    <span
      className={cn(
        "mx-1 w-px shrink-0 bg-[color:var(--dashboard-widget-border,#e4e7ec)]",
        tall ? "h-7" : "h-5",
      )}
      aria-hidden
    />
  );
}

function matchFontFamily(current: string | undefined, option: string): boolean {
  if (!current) return option.startsWith("SimSun");
  return current.replace(/['"]/g, "").includes(option.split(",")[0].replace(/['"]/g, ""));
}

type SelectionSnapshot = { from: number; to: number };

function useRichTextSelectionSnapshot(editor: Editor) {
  const selectionRef = useRef<SelectionSnapshot | null>(null);

  useEffect(() => {
    const sync = () => {
      const { from, to } = editor.state.selection;
      selectionRef.current = { from, to };
    };
    sync();
    editor.on("selectionUpdate", sync);
    editor.on("transaction", sync);
    return () => {
      editor.off("selectionUpdate", sync);
      editor.off("transaction", sync);
    };
  }, [editor]);

  const captureSelection = () => {
    const { from, to } = editor.state.selection;
    selectionRef.current = { from, to };
  };

  const runEditorCommand = (runner: (chain: ChainedCommands) => void) => {
    const snapshot = selectionRef.current;
    if (snapshot) {
      editor.commands.setTextSelection(snapshot);
    }
    runner(editor.chain().focus());
    if (snapshot) {
      editor.commands.setTextSelection(snapshot);
    }
  };

  const isMarkActive = (name: string) => {
    if (editor.isActive(name)) return true;
    const mark = editor.schema.marks[name];
    if (!mark) return false;
    const { from, to } = editor.state.selection;
    if (from !== to) {
      return editor.state.doc.rangeHasMark(from, to, mark);
    }
    const snapshot = selectionRef.current;
    if (snapshot && snapshot.from !== snapshot.to) {
      return editor.state.doc.rangeHasMark(snapshot.from, snapshot.to, mark);
    }
    if (snapshot) {
      const $pos = editor.state.doc.resolve(Math.min(snapshot.from, editor.state.doc.content.size));
      if ($pos.marks().some((item) => item.type.name === name)) return true;
    }
    return editor.state.selection.$from.marks().some((item) => item.type.name === name);
  };

  return { runEditorCommand, isMarkActive, captureSelection };
}

const RICH_TEXT_COLOR_TRIGGER_SHELL = cn(
  "[&_button]:!h-7 [&_button]:min-h-7 [&_button]:rounded-md",
  "[&_button]:border-[color:var(--dashboard-widget-border,#e4e7ec)]",
  "[&_button]:bg-[var(--dashboard-dialog-bg,#ffffff)]",
  "[&_button]:text-[color:var(--dashboard-text-primary,#344054)]",
  "[&_button]:shadow-none",
  "[&_button:hover]:bg-white/10",
  "[&_button_svg]:text-[color:var(--dashboard-text-secondary,#98a2b3)]",
);

export const RichTextToolbar = forwardRef<HTMLDivElement, RichTextToolbarProps>(function RichTextToolbar(
  { editor, className, style, density = "comfortable", floating = false, "data-testid": testId },
  ref,
) {
  const theme = useRichTextTheme();
  const { runEditorCommand, isMarkActive, captureSelection } = useRichTextSelectionSnapshot(editor);
  const overlayProps = buildRichTextOverlayProps(theme.style);
  const colorPopoverProps = {
    ...buildRichTextOverlayProps(theme.style, "rounded-xl shadow-theme-lg"),
    side: floating ? ("top" as const) : ("bottom" as const),
    collisionPadding: 16,
  };
  const comfortable = density === "comfortable";
  const [, bump] = useState(0);

  useEffect(() => {
    const refresh = () => bump((value) => value + 1);
    editor.on("transaction", refresh);
    editor.on("selectionUpdate", refresh);
    return () => {
      editor.off("transaction", refresh);
      editor.off("selectionUpdate", refresh);
    };
  }, [editor]);

  const textStyle = editor.getAttributes("textStyle");
  const currentSize = (textStyle.fontSize as string | undefined) ?? RICH_TEXT_DEFAULT_FONT_SIZE;
  const currentColor = (textStyle.color as string | undefined) ?? "#111827";
  const currentHighlight = (textStyle.backgroundColor as string | undefined) ?? "";
  const currentFamily =
    FONT_FAMILIES.find((item) => matchFontFamily(textStyle.fontFamily as string | undefined, item.value))
      ?.value ?? FONT_FAMILIES[0].value;

  const iconClass = comfortable ? "size-4" : "size-3.5";
  const btnClass = comfortable ? "size-9" : "size-7";
  const controlH = comfortable ? "h-9" : "h-7";
  const surfaceBtn =
    "text-[color:var(--dashboard-text-primary,#344054)] hover:bg-black/[0.04] hover:text-[color:var(--dashboard-text-primary,#344054)] dark:hover:bg-white/10";
  const surfaceActive =
    "bg-brand-500/15 text-[color:var(--dashboard-text-primary,#344054)] ring-1 ring-inset ring-brand-500/35 dark:bg-brand-500/25 dark:ring-brand-400/45";
  const selectTriggerClass = cn(
    "dashboard-no-drag shrink-0 !h-7 min-h-7 !py-0 border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0",
    "!text-[color:var(--dashboard-text-primary,#344054)] [&_span]:text-inherit",
    "[&_svg]:size-3 [&_svg]:text-[color:var(--dashboard-text-secondary,#98a2b3)]",
    surfaceBtn,
  );

  const ToolbarIcon = ({
    label,
    active,
    disabled,
    onClick,
    children,
  }: {
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
  }) => (
    <IconButton
      type="button"
      variant="ghost"
      size={comfortable ? "sm" : "xs"}
      className={cn(
        btnClass,
        "shrink-0 rounded-md",
        surfaceBtn,
        active && surfaceActive,
      )}
      aria-label={label}
      aria-pressed={active}
      showTooltip={false}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </IconButton>
  );

  const preventBlur = (event: MouseEvent) => event.preventDefault();

  return (
    <div
      ref={ref}
      data-testid={testId ?? "rich-text-toolbar"}
      {...richTextEditorSurfaceProps}
      style={style}
      className={cn(
        "dashboard-no-drag z-[121] border border-[var(--dashboard-widget-border,#e4e7ec)] bg-[var(--dashboard-dialog-bg,#ffffff)] text-[var(--dashboard-text-primary,#344054)]",
        floating ? "rounded-lg px-2 py-1 shadow-theme-sm" : "rounded-none border-t px-2.5 py-2 shadow-theme-md",
        comfortable && !floating && "min-w-[42rem] max-w-[calc(100vw-1.5rem)]",
        floating && "w-max",
        className,
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDownCapture={captureSelection}
    >
      <div className="flex items-center gap-1 overflow-x-only">
        <ToolbarIcon
          label="撤销"
          disabled={!editor.can().chain().focus().undo().run()}
          onClick={() => runEditorCommand((chain) => chain.undo().run())}
        >
          <Undo2 className={iconClass} />
        </ToolbarIcon>
        <ToolbarIcon
          label="重做"
          disabled={!editor.can().chain().focus().redo().run()}
          onClick={() => runEditorCommand((chain) => chain.redo().run())}
        >
          <Redo2 className={iconClass} />
        </ToolbarIcon>

        <Divider tall={comfortable} />

        <Select
          value={currentFamily}
          onValueChange={(value) => runEditorCommand((chain) => chain.setFontFamily(value).run())}
        >
          <SelectTrigger
            className={cn(
              selectTriggerClass,
              comfortable ? "w-28 px-2 text-sm" : "w-[4.5rem] px-1.5 text-xs",
            )}
            aria-label="字体"
            onMouseDown={preventBlur}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent {...overlayProps}>
            {FONT_FAMILIES.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                {font.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentSize}
          onValueChange={(value) => runEditorCommand((chain) => chain.setFontSize(value).run())}
        >
          <SelectTrigger
            className={cn(
              selectTriggerClass,
              comfortable ? "w-28 px-2 text-sm" : "w-[4.75rem] px-1.5 text-xs",
            )}
            aria-label="字号"
            onMouseDown={preventBlur}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent {...overlayProps}>
            {RICH_TEXT_FONT_SIZES.map((size) => (
              <SelectItem key={size} value={size}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Divider tall={comfortable} />

        <div className="flex shrink-0 items-center" onMouseDown={preventBlur}>
          <ColorField
            variant="swatch"
            showLabel={false}
            showHintTooltip={false}
            compact
            allowClear={false}
            liveCommitMs={0}
            swatchTriggerPreset="text"
            value={currentColor}
            swatches={TEXT_COLOR_RECOMMENDED}
            buttonAriaLabel="文字颜色"
            className={RICH_TEXT_COLOR_TRIGGER_SHELL}
            popoverContentProps={colorPopoverProps}
            onChange={(color) => {
              if (!color) return;
              runEditorCommand((chain) => chain.setColor(color).run());
            }}
          />
        </div>

        <div className="flex shrink-0 items-center" onMouseDown={preventBlur}>
          <ColorField
            variant="swatch"
            showLabel={false}
            showHintTooltip={false}
            compact
            allowClear
            liveCommitMs={0}
            swatchTriggerPreset="highlight"
            value={currentHighlight}
            swatches={HIGHLIGHT_COLOR_RECOMMENDED}
            buttonAriaLabel="高亮颜色"
            className={RICH_TEXT_COLOR_TRIGGER_SHELL}
            popoverContentProps={colorPopoverProps}
            onChange={(color) => {
              if (!color) {
                runEditorCommand((chain) => chain.unsetHighlightColor().run());
                return;
              }
              runEditorCommand((chain) => chain.setHighlightColor(color).run());
            }}
          />
        </div>

        <Divider tall={comfortable} />

        <ToolbarIcon label="粗体" active={isMarkActive("bold")} onClick={() => runEditorCommand((chain) => chain.toggleBold().run())}>
          <Bold className={iconClass} />
        </ToolbarIcon>
        <ToolbarIcon label="斜体" active={isMarkActive("italic")} onClick={() => runEditorCommand((chain) => chain.toggleItalic().run())}>
          <Italic className={iconClass} />
        </ToolbarIcon>
        <ToolbarIcon label="下划线" active={isMarkActive("underline")} onClick={() => runEditorCommand((chain) => chain.toggleUnderline().run())}>
          <Underline className={iconClass} />
        </ToolbarIcon>
        <ToolbarIcon label="删除线" active={isMarkActive("strike")} onClick={() => runEditorCommand((chain) => chain.toggleStrike().run())}>
          <Strikethrough className={iconClass} />
        </ToolbarIcon>
        <ToolbarIcon
          label="插入链接"
          active={isMarkActive("link")}
          onClick={() => {
            const href = window.prompt("输入链接地址", editor.getAttributes("link").href ?? "");
            if (href === null) return;
            if (!href.trim()) {
              runEditorCommand((chain) => chain.unsetLink().run());
              return;
            }
            runEditorCommand((chain) => chain.setLink({ href: href.trim(), target: "_blank" }).run());
          }}
        >
          <Link2 className={iconClass} />
        </ToolbarIcon>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "dashboard-no-drag inline-flex shrink-0 items-center gap-1 rounded-md px-1.5",
                surfaceBtn,
                controlH,
              )}
              aria-label="列表"
              onMouseDown={preventBlur}
            >
              <List className={iconClass} />
              <ChevronDown className="size-4 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" {...overlayProps}>
            <DropdownMenuItem className="text-sm" onClick={() => runEditorCommand((chain) => chain.toggleBulletList().run())}>
              <List className="size-4" />
              无序列表
            </DropdownMenuItem>
            <DropdownMenuItem className="text-sm" onClick={() => runEditorCommand((chain) => chain.toggleOrderedList().run())}>
              <ListOrdered className="size-4" />
              有序列表
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Divider tall={comfortable} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "dashboard-no-drag inline-flex shrink-0 items-center justify-center rounded-md",
                surfaceBtn,
                btnClass,
              )}
              aria-label="更多格式"
              onMouseDown={preventBlur}
            >
              <MoreHorizontal className={iconClass} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" {...overlayProps}>
            <DropdownMenuItem className="text-sm" onClick={() => runEditorCommand((chain) => chain.setTextAlign("left").run())}>
              <AlignLeft className="size-4" />
              左对齐
            </DropdownMenuItem>
            <DropdownMenuItem className="text-sm" onClick={() => runEditorCommand((chain) => chain.setTextAlign("center").run())}>
              <AlignCenter className="size-4" />
              居中对齐
            </DropdownMenuItem>
            <DropdownMenuItem className="text-sm" onClick={() => runEditorCommand((chain) => chain.setTextAlign("right").run())}>
              <AlignRight className="size-4" />
              右对齐
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-sm"
              onClick={() => runEditorCommand((chain) => chain.unsetAllMarks().clearNodes().run())}
            >
              <Eraser className="size-4" />
              清除格式
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
