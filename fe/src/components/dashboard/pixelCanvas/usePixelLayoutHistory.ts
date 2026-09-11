import { useCallback, useEffect, useReducer } from "react";
import type { DashboardLayoutV2 } from "../layoutUtils";

type State = {
  layout: DashboardLayoutV2;
  past: DashboardLayoutV2[];
  future: DashboardLayoutV2[];
  savedFingerprint: string;
};

type Action =
  | { type: "set"; layout: DashboardLayoutV2 }
  | { type: "reset"; layout: DashboardLayoutV2 }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "markSaved" };

type Options = {
  initialLayout: DashboardLayoutV2;
  keyboardEnabled?: boolean;
};

function cloneLayout(layout: DashboardLayoutV2): DashboardLayoutV2 {
  return structuredClone(layout);
}

export function pixelLayoutFingerprint(layout: DashboardLayoutV2): string {
  return JSON.stringify(layout);
}

function createState(layout: DashboardLayoutV2): State {
  const snapshot = cloneLayout(layout);
  return {
    layout: snapshot,
    past: [],
    future: [],
    savedFingerprint: pixelLayoutFingerprint(snapshot),
  };
}

function reducer(state: State, action: Action): State {
  if (action.type === "reset") return createState(action.layout);
  if (action.type === "markSaved") {
    return { ...state, savedFingerprint: pixelLayoutFingerprint(state.layout) };
  }
  if (action.type === "set") {
    const next = cloneLayout(action.layout);
    if (pixelLayoutFingerprint(next) === pixelLayoutFingerprint(state.layout)) {
      return { ...state, layout: next };
    }
    return {
      ...state,
      layout: next,
      past: [...state.past, cloneLayout(state.layout)],
      future: [],
    };
  }
  if (action.type === "undo") {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return {
      ...state,
      layout: cloneLayout(previous),
      past: state.past.slice(0, -1),
      future: [cloneLayout(state.layout), ...state.future],
    };
  }
  const next = state.future[0];
  if (!next) return state;
  return {
    ...state,
    layout: cloneLayout(next),
    past: [...state.past, cloneLayout(state.layout)],
    future: state.future.slice(1),
  };
}

function isShortcutSuppressed(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-pixel-no-shortcut]',
    ),
  );
}

export function usePixelLayoutHistory({
  initialLayout,
  keyboardEnabled = true,
}: Options) {
  const [state, dispatch] = useReducer(reducer, initialLayout, createState);
  const setLayout = useCallback((layout: DashboardLayoutV2) => {
    dispatch({ type: "set", layout });
  }, []);
  const resetLayout = useCallback((layout: DashboardLayoutV2) => {
    dispatch({ type: "reset", layout });
  }, []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const markSaved = useCallback(() => dispatch({ type: "markSaved" }), []);

  useEffect(() => {
    if (!keyboardEnabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (isShortcutSuppressed(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keyboardEnabled, redo, undo]);

  return {
    layout: state.layout,
    setLayout,
    resetLayout,
    undo,
    redo,
    markSaved,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    isDirty: pixelLayoutFingerprint(state.layout) !== state.savedFingerprint,
  };
}
