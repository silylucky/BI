import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DEFAULT_NAME = "未命名看板";

type DashboardInlineTitleProps = {
  value: string;
  onChange: (value: string) => void;
};

/** 看板编辑页标题：展示态 + 点击/铅笔进入重命名，Enter 保存、Esc 取消 */
export function DashboardInlineTitle({ value, onChange }: DashboardInlineTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (!editing) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editing]);

  const commit = () => {
    const next = draft.trim() || DEFAULT_NAME;
    onChange(next);
    setDraft(next);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const startEdit = () => setEditing(true);

  if (editing) {
    return (
      <h1
        className="text-title-sm font-semibold text-gray-900 dark:text-white"
        data-testid="dashboard-name-field"
      >
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          placeholder={DEFAULT_NAME}
          aria-label="看板名称"
          className="max-w-md text-title-sm font-semibold"
          maxLength={120}
        />
      </h1>
    );
  }

  const display = value.trim() || DEFAULT_NAME;
  const isPlaceholder = !value.trim();

  return (
    <h1
      className="group flex min-w-0 max-w-xl items-center gap-0.5 text-title-sm font-semibold"
      data-testid="dashboard-name-field"
    >
      <button
        type="button"
        onClick={startEdit}
        className={cn(
          "-ml-1 min-w-0 max-w-full truncate rounded-lg px-2 py-1 text-left transition-colors",
          "hover:bg-gray-100 hover:text-brand-600",
          "focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20",
          "dark:hover:bg-white/[0.06] dark:hover:text-brand-400",
          isPlaceholder
            ? "text-gray-400 dark:text-gray-500"
            : "text-gray-900 dark:text-white",
        )}
        aria-label={`看板名称：${display}，点击重命名`}
      >
        {display}
      </button>
      <IconButton
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "size-8 shrink-0 text-gray-400 dark:text-gray-500",
          "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
          "focus-visible:opacity-100",
        )}
        aria-label="重命名看板"
        onClick={startEdit}
      >
        <Pencil className="size-4" aria-hidden />
      </IconButton>
    </h1>
  );
}
