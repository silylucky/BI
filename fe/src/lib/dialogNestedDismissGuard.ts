/** Radix Select/Popover 经 Portal 挂到 Dialog 外；须阻止 outside 事件误关弹层 */

const NESTED_LAYER_SELECTOR =
  '[data-slot="select-content"], [data-radix-select-content], [role="listbox"], [role="menu"], [data-radix-menu-content], [data-radix-popper-content-wrapper], [data-dialog-select-portal]';

function elementMatchesNestedLayer(node: EventTarget | null): boolean {
  if (!(node instanceof HTMLElement)) return false;
  return Boolean(node.matches?.(NESTED_LAYER_SELECTOR) || node.closest(NESTED_LAYER_SELECTOR));
}

function resolveInspectEvent(event: Event): Event {
  if ("detail" in event) {
    const detail = (event as CustomEvent<{ originalEvent?: Event }>).detail;
    if (detail?.originalEvent) return detail.originalEvent;
  }
  return event;
}

function collectEventNodes(event: Event): EventTarget[] {
  const inspect = resolveInspectEvent(event);
  const nodes: EventTarget[] = [];
  if (inspect.target) nodes.push(inspect.target);
  if (event.target && event.target !== inspect.target) nodes.push(event.target);
  if ("composedPath" in inspect) nodes.push(...inspect.composedPath());
  if (inspect !== event && "composedPath" in event) nodes.push(...event.composedPath());
  return nodes;
}

export function isDialogNestedPortaledLayer(target: EventTarget | null, event?: Event): boolean {
  if (elementMatchesNestedLayer(target)) return true;
  if (!event) return false;
  for (const node of collectEventNodes(event)) {
    if (elementMatchesNestedLayer(node)) return true;
  }
  return false;
}

export function isAnySelectDropdownOpen(): boolean {
  return Boolean(
    document.querySelector('[data-slot="select-content"][data-state="open"]') ||
      document.querySelector('[data-radix-select-content][data-state="open"]') ||
      document.querySelector('[role="listbox"][data-state="open"]') ||
      document.querySelector('[role="menu"][data-state="open"]') ||
      document.querySelector('[role="combobox"][aria-expanded="true"]'),
  );
}

function isFocusInsideNestedLayer(): boolean {
  return isDialogNestedPortaledLayer(document.activeElement);
}

/** pointerdown 捕获阶段标记：处理 Select 先关、Dialog 后判 outside 的竞态 */
let nestedLayerPointerActive = false;

if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (event) => {
      nestedLayerPointerActive = isDialogNestedPortaledLayer(event.target, event);
    },
    true,
  );
  document.addEventListener(
    "pointerup",
    () => {
      queueMicrotask(() => {
        nestedLayerPointerActive = false;
      });
    },
    true,
  );
}

export function isNestedLayerPointerActive(): boolean {
  return nestedLayerPointerActive;
}

export function isDialogDismissBlocked(event: Event): boolean {
  if (isAnySelectDropdownOpen()) return true;
  if (isNestedLayerPointerActive()) return true;
  if (isFocusInsideNestedLayer()) return true;
  return isDialogNestedPortaledLayer(event.target, event);
}

export function guardDialogDismiss(event: Event): void {
  if (isDialogDismissBlocked(event)) {
    event.preventDefault();
  }
}

/** Dialog onOpenChange 最后一道防线：Radix outside 已触发时仍拦截关窗 */
export function shouldBlockDialogClose(): boolean {
  return isAnySelectDropdownOpen() || isNestedLayerPointerActive() || isFocusInsideNestedLayer();
}
