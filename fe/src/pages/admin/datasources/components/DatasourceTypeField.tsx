import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ConnectorTypeItem } from "@/lib/connector-taxonomy";
import {
  CONNECTOR_FIELD_HINTS,
  CONNECTOR_HINT_TEXT,
  showConnectorHint,
} from "./datasource-form-constants";
import { CONNECTION_CONTROL_CLASS, ConnectionFormField } from "./ConnectionFormField";

export function TypeHint({ type }: { type: string }) {
  if (!showConnectorHint(type)) return null;
  const id = type === "oceanbase" ? "oceanbase-hint" : type === "gaussdb" ? "gaussdb-hint" : "impala-hint";
  return (
    <p id={id} className="rounded-lg border border-brand-200/60 bg-brand-50/50 px-3 py-2 text-theme-xs leading-relaxed text-brand-800 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
      {CONNECTOR_HINT_TEXT[type]}
    </p>
  );
}

type Props = {
  mode: "create" | "edit";
  type: string;
  selectedTypeLabel: string;
  typeItems: ConnectorTypeItem[];
  onTypeChange: (type: string) => void;
};

export function DatasourceTypeField({
  mode,
  type,
  selectedTypeLabel,
  typeItems,
  onTypeChange,
}: Props) {
  if (mode === "edit") {
    return (
      <div className="flex flex-col gap-3">
        <ConnectionFormField label="类型" htmlFor="datasource-type">
          <Select value={type} onValueChange={onTypeChange}>
            <SelectTrigger id="datasource-type" className={CONNECTION_CONTROL_CLASS}>
              <SelectValue placeholder="选择类型" />
            </SelectTrigger>
            <SelectContent>
              {(typeItems.length ? typeItems : [{ type: "mysql", displayName: "MySQL" }]).map((t) => (
                <SelectItem key={t.type} value={t.type}>
                  {t.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ConnectionFormField>
        <TypeHint type={type} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ConnectionFormField label="类型">
        <p className="flex h-11 items-center rounded-lg border border-gray-200 bg-gray-50/80 px-4 text-theme-sm font-medium text-gray-800 dark:border-gray-700 dark:bg-white/[0.03] dark:text-white/90">
          {selectedTypeLabel}
        </p>
      </ConnectionFormField>
      <TypeHint type={type} />
    </div>
  );
}

export function applyTypePort(type: string, prevPort: string): string {
  return CONNECTOR_FIELD_HINTS[type]?.port ?? prevPort;
}
