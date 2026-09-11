import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EtlFormField } from "./EtlFormField";

const CONTROL_CLASS = "h-11";

export function EtlColumnField({
  label,
  value,
  onChange,
  columnNames,
  placeholder,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  columnNames: string[];
  placeholder?: string;
  invalid?: boolean;
}) {
  const trimmed = value.trim();
  const inList = trimmed && columnNames.includes(trimmed);
  const [manual, setManual] = useState(columnNames.length === 0 || (Boolean(trimmed) && !inList));

  useEffect(() => {
    if (columnNames.length === 0) {
      setManual(true);
      return;
    }
    if (!trimmed) {
      setManual(false);
      return;
    }
    setManual(!columnNames.includes(trimmed));
  }, [columnNames, trimmed]);

  const options =
    trimmed && !columnNames.includes(trimmed) ? [trimmed, ...columnNames] : columnNames;
  const fieldId = `etl-column-${label}`;

  return (
    <EtlFormField
      label={label}
      htmlFor={fieldId}
      action={
        columnNames.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-theme-xs text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
            onClick={() => setManual((prev) => !prev)}
          >
            {manual ? "切换为下拉" : "切换为手填"}
          </Button>
        ) : undefined
      }
    >
      {manual || columnNames.length === 0 ? (
        <Input
          id={fieldId}
          className={CONTROL_CLASS}
          value={value}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger
            id={fieldId}
            aria-label={label}
            aria-invalid={invalid || undefined}
            className={CONTROL_CLASS}
          >
            <SelectValue placeholder={placeholder ?? "选择列"} />
          </SelectTrigger>
          <SelectContent>
            {options.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </EtlFormField>
  );
}
