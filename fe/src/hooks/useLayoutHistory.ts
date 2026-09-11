import { useCallback, useEffect, useReducer } from "react";
import {
  canRedoLayout,
  canUndoLayout,
  createLayoutHistoryStacks,
  layoutFingerprint,
  pushLayoutHistory,
  redoLayout,
  undoLayout,
  type LayoutHistoryStacks,
} from "@/components/dashboard/layoutHistory";
import { sortWidgets, type LayoutWidget } from "@/components/dashboard/layoutUtils";

type HistoryState = {
  widgets: LayoutWidget[];
  stacks: LayoutHistoryStacks;
};

type HistoryAction =
  | { type: "reset"; widgets: LayoutWidget[] }
  | { type: "set"; next: LayoutWidget[] | ((prev: LayoutWidget[]) => LayoutWidget[]) }
  | { type: "undo" }
  | { type: "redo" };

function resolveNext(
  prev: LayoutWidget[],
  next: LayoutWidget[] | ((prev: LayoutWidget[]) => LayoutWidget[]),
): LayoutWidget[] {
  const resolved = typeof next === "function" ? next(prev) : next;
  return sortWidgets(resolved);
}

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "reset":
      return {
        widgets: sortWidgets(action.widgets),
        stacks: createLayoutHistoryStacks(),
      };
    case "set": {
      const resolved = resolveNext(state.widgets, action.next);
      if (layoutFingerprint(state.widgets) === layoutFingerprint(resolved)) {
        return { ...state, widgets: resolved };
      }
      return {
        widgets: resolved,
        stacks: pushLayoutHistory(state.stacks, state.widgets),
      };
    }
    case "undo": {
      const result = undoLayout(state.stacks, state.widgets);
      if (!result) return state;
      return { widgets: result.widgets, stacks: result.stacks };
    }
    case "redo": {
      const result = redoLayout(state.stacks, state.widgets);
      if (!result) return state;
      return { widgets: result.widgets, stacks: result.stacks };
    }
    default:
      return state;
  }
}

const initialHistoryState: HistoryState = {
  widgets: [],
  stacks: createLayoutHistoryStacks(),
};

type UseLayoutHistoryOptions = {
  keyboardEnabled?: boolean;
};

export function useLayoutHistory({ keyboardEnabled = true }: UseLayoutHistoryOptions = {}) {
  const [state, dispatch] = useReducer(historyReducer, initialHistoryState);

  const resetWidgets = useCallback((widgets: LayoutWidget[]) => {
    dispatch({ type: "reset", widgets });
  }, []);

  const setWidgets = useCallback((next: LayoutWidget[] | ((prev: LayoutWidget[]) => LayoutWidget[])) => {
    dispatch({ type: "set", next });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: "undo" });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "redo" });
  }, []);

  const canUndo = canUndoLayout(state.stacks);
  const canRedo = canRedoLayout(state.stacks);

  useEffect(() => {
    if (!keyboardEnabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (key === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
      } else if (key === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, keyboardEnabled]);

  return {
    widgets: state.widgets,
    setWidgets,
    resetWidgets,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
