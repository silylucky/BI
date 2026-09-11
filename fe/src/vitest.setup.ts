import "@testing-library/jest-dom/vitest";

const resizeCallbacks = new Set<ResizeObserverCallback>();

class ResizeObserverMock {
  constructor(private readonly callback: ResizeObserverCallback) {
    resizeCallbacks.add(callback);
  }

  observe() {}
  unobserve() {}
  disconnect() {
    resizeCallbacks.delete(this.callback);
  }
}

Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(globalThis, "__triggerResizeObservers", {
  configurable: true,
  value: () => {
    for (const callback of resizeCallbacks) callback([], {} as ResizeObserver);
  },
});

class PointerEventMock extends MouseEvent {
  pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

Object.defineProperty(globalThis, "PointerEvent", {
  writable: true,
  value: PointerEventMock,
});

const pointerCaptures = new WeakMap<HTMLElement, Set<number>>();

HTMLElement.prototype.hasPointerCapture = function (pointerId: number) {
  return pointerCaptures.get(this)?.has(pointerId) ?? false;
};
HTMLElement.prototype.setPointerCapture = function (pointerId: number) {
  const captured = pointerCaptures.get(this) ?? new Set<number>();
  captured.add(pointerId);
  pointerCaptures.set(this, captured);
};
HTMLElement.prototype.releasePointerCapture = function (pointerId: number) {
  const captured = pointerCaptures.get(this);
  if (!captured?.delete(pointerId)) return;
  this.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId, bubbles: true }));
};
Element.prototype.scrollIntoView = () => {};

const stubRect = () => ({
  bottom: 0,
  height: 0,
  left: 0,
  right: 0,
  top: 0,
  width: 0,
  x: 0,
  y: 0,
  toJSON: () => ({}),
});

const stubClientRects = () => {
  const rect = stubRect();
  return {
    length: 1,
    0: rect,
    item: (index: number) => (index === 0 ? rect : null),
    [Symbol.iterator]: function* () {
      yield rect;
    },
  } as DOMRectList;
};

for (const prototype of [Range.prototype, Element.prototype] as Array<
  { getClientRects?: () => DOMRectList; getBoundingClientRect?: () => DOMRect }
>) {
  if (!prototype.getClientRects) {
    prototype.getClientRects = stubClientRects;
  }
  if (!prototype.getBoundingClientRect) {
    prototype.getBoundingClientRect = stubRect;
  }
}

const textPrototype = Text.prototype as Text & {
  getClientRects?: () => DOMRectList;
  getBoundingClientRect?: () => DOMRect;
};
if (!textPrototype.getClientRects) {
  textPrototype.getClientRects = stubClientRects;
}
if (!textPrototype.getBoundingClientRect) {
  textPrototype.getBoundingClientRect = stubRect;
}

if (!document.elementFromPoint) {
  document.elementFromPoint = () => document.body;
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
