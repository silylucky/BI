import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type DialogFormSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type DialogFormSelectProps = {
  id?: string;
  value?: string;
  placeholder?: string;
  options: DialogFormSelectOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
};

/** Dialog 内表单下拉：DropdownMenu modal=false，避免 Radix Select 误关弹层 */
export function DialogFormSelect({
  id,
  value,
  placeholder = "请选择",
  options,
  onValueChange,
  disabled,
}: DialogFormSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const triggerLabel = selected?.label ?? placeholder;
  const hasValue = Boolean(selected);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          className={cn(
            "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm shadow-theme-xs transition-colors",
            "focus:outline-hidden focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-gray-100",
            "dark:border-gray-700 dark:bg-gray-900 dark:focus:border-brand-800 dark:disabled:bg-gray-800",
            hasValue ? "text-gray-800 dark:text-white/90" : "text-gray-400 dark:text-gray-500",
          )}
        >
          <span className="min-w-0 truncate">{triggerLabel}</span>
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className="min-w-[var(--radix-dropdown-menu-trigger-width)] p-1"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <DropdownMenuItem
              key={option.value}
              disabled={option.disabled}
              className={cn(
                "grid w-full cursor-default grid-cols-[minmax(0,1fr)_1rem] items-center gap-2 rounded-lg py-1.5 pl-3 pr-2.5 text-sm",
                active &&
                  "bg-brand-50 font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-400",
              )}
              onSelect={() => {
                if (option.disabled) return;
                onValueChange(option.value);
                setOpen(false);
              }}
            >
              <span className="min-w-0 truncate">{option.label}</span>
              <span className="flex size-4 items-center justify-center">
                {active ? (
                  <Check className="size-3.5 stroke-[2.5] text-brand-500 dark:text-brand-400" aria-hidden />
                ) : null}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
