type InteractionListener = (seriesName: string | null) => void;

const listeners = new Set<InteractionListener>();

export function subscribeSeriesFocus(listener: InteractionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSeriesFocus(seriesName: string | null): void {
  for (const fn of listeners) fn(seriesName);
}

export function dimOpacity(active: boolean, dimmed: boolean, base = 0.92): number {
  if (!dimmed) return base;
  return active ? base : 0.25;
}
