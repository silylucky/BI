/** 列表卡片 live 预览全局并发上限（仪表板/模板等共用；≈两行四列网格） */
export const MAX_LIST_PREVIEW_ACTIVATIONS = 8;

export type ListPreviewSlotRequest = {
  key?: string;
  priority?: number;
};

type WaiterCallbacks = {
  resolve: () => void;
  reject: (err: Error) => void;
};

type WaiterState = {
  key: string;
  priority: number;
  epoch: number;
  callbacks: WaiterCallbacks | null;
  granted: boolean;
};

let activeCount = 0;
let slotEpoch = 0;
const waiters = new Map<string, WaiterState>();

export class ListPreviewSlotResetError extends Error {
  constructor() {
    super("list-preview-slot-reset");
    this.name = "ListPreviewSlotResetError";
  }
}

function grantSlots(): void {
  if (activeCount >= MAX_LIST_PREVIEW_ACTIVATIONS) return;

  const pending = Array.from(waiters.values())
    .filter((waiter) => !waiter.granted && waiter.callbacks !== null)
    .sort((a, b) => b.priority - a.priority);

  for (const waiter of pending) {
    if (activeCount >= MAX_LIST_PREVIEW_ACTIVATIONS) break;
    if (waiter.epoch !== slotEpoch) {
      const callbacks = waiter.callbacks;
      waiters.delete(waiter.key);
      callbacks?.reject(new ListPreviewSlotResetError());
      continue;
    }
    waiter.granted = true;
    activeCount += 1;
    const callbacks = waiter.callbacks;
    waiter.callbacks = null;
    callbacks?.resolve();
  }
}

export function requestListPreviewSlot(
  options?: ListPreviewSlotRequest,
): Promise<void> {
  const key = options?.key ?? `anon-${Math.random().toString(36).slice(2)}`;
  const priority = options?.priority ?? 0;
  const epoch = slotEpoch;

  const existing = waiters.get(key);
  if (existing?.granted) {
    existing.priority = priority;
    return Promise.resolve();
  }

  if (existing && !existing.granted) {
    existing.priority = priority;
    grantSlots();
    if (existing.granted) return Promise.resolve();
    return new Promise((resolve, reject) => {
      existing.callbacks = { resolve, reject };
    });
  }

  return new Promise((resolve, reject) => {
    waiters.set(key, {
      key,
      priority,
      epoch,
      callbacks: { resolve, reject },
      granted: false,
    });
    grantSlots();
  });
}

export function updateListPreviewPriority(key: string, priority: number): void {
  const waiter = waiters.get(key);
  if (!waiter) return;
  waiter.priority = priority;
  if (!waiter.granted) {
    grantSlots();
  }
}

export function unregisterListPreviewWaiter(key: string): void {
  const waiter = waiters.get(key);
  if (!waiter) return;

  if (waiter.granted) {
    activeCount = Math.max(0, activeCount - 1);
  }
  waiters.delete(key);
  grantSlots();
}

export function releaseListPreviewSlot(key?: string): void {
  if (key) {
    unregisterListPreviewWaiter(key);
    return;
  }
  const grantedKey = Array.from(waiters.values()).find((waiter) => waiter.granted)?.key;
  if (grantedKey) {
    unregisterListPreviewWaiter(grantedKey);
    return;
  }
  activeCount = Math.max(0, activeCount - 1);
  grantSlots();
}

/** 导航切换时清空排队，避免旧页预览占用 slot */
export function releaseAllListPreviewSlots(): void {
  slotEpoch += 1;
  for (const waiter of waiters.values()) {
    if (!waiter.granted && waiter.callbacks) {
      waiter.callbacks.reject(new ListPreviewSlotResetError());
    }
  }
  waiters.clear();
  activeCount = 0;
}

export function resetListPreviewActivationForTests(): void {
  waiters.clear();
  activeCount = 0;
  slotEpoch = 0;
}

export function getActiveListPreviewCountForTests(): number {
  return activeCount;
}
