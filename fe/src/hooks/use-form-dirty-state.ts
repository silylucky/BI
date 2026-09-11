import { useCallback, useMemo, useRef, useState } from "react";

export function useFormDirtyState<T>(current: T, serialize: (value: T) => string) {
  const baselineRef = useRef<string | null>(null);
  const [baselineRevision, setBaselineRevision] = useState(0);

  const resetBaseline = useCallback(
    (value: T) => {
      baselineRef.current = serialize(value);
      setBaselineRevision((revision) => revision + 1);
    },
    [serialize],
  );

  const markSaved = useCallback(
    (value: T) => {
      resetBaseline(value);
    },
    [resetBaseline],
  );

  const isDirty = useMemo(() => {
    if (baselineRef.current === null) return false;
    return serialize(current) !== baselineRef.current;
  }, [baselineRevision, current, serialize]);

  const isBaselineReady = baselineRef.current !== null;

  return { isDirty, isBaselineReady, resetBaseline, markSaved };
}
