import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

type DebouncedNumberInputProps = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number | "";
  onCommit: (value: number) => void;
  debounceMs?: number;
  emptyFallback?: number;
};

const DEFAULT_DEBOUNCE_MS = 200;

export function DebouncedNumberInput({
  value,
  onCommit,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  emptyFallback = 0,
  onBlur,
  ...props
}: DebouncedNumberInputProps) {
  const [localValue, setLocalValue] = useState(String(value));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const commit = (raw: string) => {
    const parsed = raw.trim() === "" ? emptyFallback : Number(raw);
    if (Number.isNaN(parsed)) return;
    onCommit(parsed);
  };

  const scheduleCommit = (raw: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => commit(raw), debounceMs);
  };

  return (
    <Input
      {...props}
      type="number"
      value={localValue}
      onChange={(event) => {
        const next = event.target.value;
        setLocalValue(next);
        scheduleCommit(next);
      }}
      onBlur={(event) => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        commit(localValue);
        onBlur?.(event);
      }}
    />
  );
}
