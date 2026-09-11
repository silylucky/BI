import {
  classifyDatasetField,
  groupDatasetFields,
  suggestDatasetBindColumns,
  type DatasetFieldKind,
} from "@/components/dashboard/datasetFieldClassification";
import type { DatasetBindDraft } from "../types";

export const EMPTY_BIND_DRAFT: DatasetBindDraft = {
  selectedColumns: [],
  columnKinds: {},
};

export function seedBindDraftFromColumns(
  columnNames: string[],
  existing?: DatasetBindDraft | null,
): DatasetBindDraft {
  if (existing && existing.selectedColumns.length > 0) {
    const kinds = { ...existing.columnKinds };
    for (const col of columnNames) {
      if (!(col in kinds)) kinds[col] = classifyDatasetField(col);
    }
    return {
      selectedColumns: existing.selectedColumns.filter((c) => columnNames.includes(c)),
      columnKinds: kinds,
    };
  }
  const selected = suggestDatasetBindColumns(columnNames);
  const columnKinds: Record<string, DatasetFieldKind> = {};
  for (const col of columnNames) {
    columnKinds[col] = classifyDatasetField(col);
  }
  return { selectedColumns: selected, columnKinds };
}

export function bindDraftFromBinding(
  columns: string[],
  columnKinds?: Record<string, DatasetFieldKind>,
): DatasetBindDraft {
  const kinds: Record<string, DatasetFieldKind> = {};
  for (const col of columns) {
    kinds[col] = columnKinds?.[col] ?? classifyDatasetField(col);
  }
  return { selectedColumns: [...columns], columnKinds: kinds };
}

export function toggleColumnInDraft(draft: DatasetBindDraft, name: string, checked: boolean): DatasetBindDraft {
  const selectedColumns = checked
    ? draft.selectedColumns.includes(name)
      ? draft.selectedColumns
      : [...draft.selectedColumns, name]
    : draft.selectedColumns.filter((c) => c !== name);
  const columnKinds = { ...draft.columnKinds };
  if (!(name in columnKinds)) columnKinds[name] = classifyDatasetField(name);
  return { selectedColumns, columnKinds };
}

export function toggleFieldKind(draft: DatasetBindDraft, name: string): DatasetBindDraft {
  const current = draft.columnKinds[name] ?? classifyDatasetField(name);
  return {
    ...draft,
    columnKinds: {
      ...draft.columnKinds,
      [name]: current === "metric" ? "dimension" : "metric",
    },
  };
}

export function autoIdentifyDraft(columnNames: string[]): DatasetBindDraft {
  return seedBindDraftFromColumns(columnNames, null);
}

export function selectAllDraft(columnNames: string[]): DatasetBindDraft {
  const columnKinds: Record<string, DatasetFieldKind> = {};
  for (const col of columnNames) {
    columnKinds[col] = classifyDatasetField(col);
  }
  return { selectedColumns: [...columnNames], columnKinds };
}

export function groupedVisibleFields(
  columnNames: string[],
  draft: DatasetBindDraft,
): { dimensions: string[]; metrics: string[] } {
  const visible = columnNames.filter((c) => draft.selectedColumns.includes(c));
  return groupDatasetFields(visible, draft.columnKinds);
}

export function resolveKindForField(
  field: string,
  draft: DatasetBindDraft,
): DatasetFieldKind {
  return draft.columnKinds[field] ?? classifyDatasetField(field);
}
