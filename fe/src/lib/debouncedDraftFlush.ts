/** Flush debounced dashboard inspector drafts before save. */

const flushers = new Set<() => void>();

export function registerDebouncedDraftFlusher(flush: () => void): () => void {
  flushers.add(flush);
  return () => {
    flushers.delete(flush);
  };
}

export function flushDebouncedDrafts(): void {
  for (const flush of flushers) {
    flush();
  }
}

export function clearDebouncedDraftFlushersForTests(): void {
  flushers.clear();
}
