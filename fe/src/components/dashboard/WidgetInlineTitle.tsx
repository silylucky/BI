import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type WidgetInlineTitleProps = {
  value: string;
  onChange?: (value: string) => void;
  editable?: boolean;
  titleStyle?: CSSProperties;
  ariaLabel?: string;
  testId?: string;
  className?: string;
};

/** 编辑/只读共用排版壳，避免点击后字号与行高跳动 */
const titleShellClass = (className?: string) =>
  cn(
    "widget-inline-title min-w-0 flex-1 bg-transparent px-1 text-theme-sm font-semibold leading-snug",
    className,
  );

/**
 * DataEase 式组件标题：默认纯文字；点击后进入内联编辑。
 */
export function WidgetInlineTitle({
  value,
  onChange,
  editable = false,
  titleStyle,
  ariaLabel = "组件标题",
  testId,
  className,
}: WidgetInlineTitleProps) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const stopBubble = (event: MouseEvent) => {
    event.stopPropagation();
  };

  if (!editable || !onChange) {
    return (
      <span
        className={cn(titleShellClass(className), "truncate")}
        style={titleStyle}
        data-testid={testId}
      >
        {value}
      </span>
    );
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={value}
        inputSkin="borderless"
        data-testid={testId}
        onChange={(e) => onChange(e.target.value)}
        onMouseDown={stopBubble}
        onClick={stopBubble}
        onPointerDown={stopBubble}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape" || e.key === "Enter") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        className={cn(
          titleShellClass(className),
          "dashboard-no-drag !h-auto !min-h-0 w-full !bg-transparent !py-0 shadow-none focus-visible:ring-2 focus-visible:ring-brand-500/25",
        )}
        style={titleStyle}
        aria-label={ariaLabel}
      />
    );
  }

  return (
    <span
      className={cn(
        titleShellClass(className),
        "dashboard-no-drag cursor-text truncate rounded hover:bg-gray-100/80 dark:hover:bg-white/5",
      )}
      style={titleStyle}
      data-testid={testId}
      onMouseDown={stopBubble}
      onClick={(e) => {
        stopBubble(e);
        setEditing(true);
      }}
      onDoubleClick={(e) => {
        stopBubble(e);
        setEditing(true);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          setEditing(true);
        }
      }}
    >
      {value}
    </span>
  );
}
