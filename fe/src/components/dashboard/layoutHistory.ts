import { sortWidgets, type LayoutWidget } from "./layoutUtils";

export function layoutFingerprint(widgets: LayoutWidget[]): string {
  return JSON.stringify(sortWidgets(widgets));
}

function cloneSnapshot(widgets: LayoutWidget[]): LayoutWidget[] {
  return sortWidgets(
    widgets.map((w) => ({
      ...w,
      chartConfig: w.chartConfig ? { ...w.chartConfig } : undefined,
      filterConfig: w.filterConfig
        ? {
            ...w.filterConfig,
            options: w.filterConfig.options?.map((o) => ({ ...o })),
          }
        : undefined,
    })),
  );
}

export type LayoutHistoryStacks = {
  past: LayoutWidget[][];
  future: LayoutWidget[][];
};

export function createLayoutHistoryStacks(): LayoutHistoryStacks {
  return { past: [], future: [] };
}

/** Push snapshot onto past; skip when fingerprint matches latest past entry. */
export function pushLayoutHistory(
  stacks: LayoutHistoryStacks,
  snapshot: LayoutWidget[],
): LayoutHistoryStacks {
  const fp = layoutFingerprint(snapshot);
  const latest = stacks.past[stacks.past.length - 1];
  if (latest && layoutFingerprint(latest) === fp) {
    return stacks;
  }
  return {
    past: [...stacks.past, cloneSnapshot(snapshot)],
    future: [],
  };
}

export function canUndoLayout(stacks: LayoutHistoryStacks): boolean {
  return stacks.past.length > 0;
}

export function canRedoLayout(stacks: LayoutHistoryStacks): boolean {
  return stacks.future.length > 0;
}

export function undoLayout(
  stacks: LayoutHistoryStacks,
  current: LayoutWidget[],
): { stacks: LayoutHistoryStacks; widgets: LayoutWidget[] } | null {
  if (stacks.past.length === 0) return null;
  const past = [...stacks.past];
  const previous = past.pop()!;
  return {
    stacks: {
      past,
      future: [cloneSnapshot(current), ...stacks.future],
    },
    widgets: previous,
  };
}

export function redoLayout(
  stacks: LayoutHistoryStacks,
  current: LayoutWidget[],
): { stacks: LayoutHistoryStacks; widgets: LayoutWidget[] } | null {
  if (stacks.future.length === 0) return null;
  const future = [...stacks.future];
  const next = future.shift()!;
  return {
    stacks: {
      past: [...stacks.past, cloneSnapshot(current)],
      future,
    },
    widgets: next,
  };
}
