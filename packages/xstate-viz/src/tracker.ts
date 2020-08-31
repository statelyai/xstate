import { Rect } from "./Rect";

export interface TrackerData {
  rect: null | Rect;
  absolute: null | Rect;
  element: null | Element;
  listeners: Set<TrackerListener>;
}

type TrackerListener = (data: TrackerData) => void;

function isHidden(el: HTMLElement) {
  const result =
    !el.offsetWidth && !el.offsetHeight && !el.getClientRects().length;
  return result;
}

export class Tracker {
  public data: Record<string, TrackerData> = {};

  constructor(private parentElement: Element = document.body) {}

  private getParent(el: Element) {
    return el.closest('[data-xviz="machine"]') || this.parentElement;
  }

  public update(id: string, el: Element) {
    if (!this.data[id]) {
      this.register(id);
    }

    const currentData = this.data[id];
    currentData.element = el;

    if (isHidden(el as HTMLElement)) {
      currentData.rect = null;
    } else {
      const absoluteRect = el.getBoundingClientRect();
      const clientRect = relative(absoluteRect, this.getParent(el));

      const scale = clientRect.width / (el as HTMLElement).offsetWidth;

      if (currentData.rect?.equals(clientRect)) {
        return;
      }

      currentData.rect = new Rect(clientRect, scale);
      currentData.absolute = new Rect(absoluteRect);
    }

    currentData.listeners.forEach((listener) => {
      listener(currentData);
    });
  }

  public remove(id: string) {
    const currentData = this.data[id];
    currentData.rect = null;
    currentData.element = null;

    currentData.listeners.forEach((listener) => {
      listener(currentData);
    });
  }

  public updateAll(options?: { scale: number }) {
    Object.entries(this.data).forEach(([id, value]) => {
      if (value.element) {
        this.update(id, value.element);
      }
    });
  }

  public register(id: string) {
    this.data[id] = {
      rect: null,
      absolute: null,
      element: null,
      listeners: new Set(),
    };
  }

  public listen(id: string, listener: TrackerListener) {
    if (!this.data[id]) {
      this.register(id);
    }

    this.data[id].listeners.add(listener);

    listener(this.data[id]);
  }

  public unlisten(id: string, listener: TrackerListener) {
    this.data[id].listeners.delete(listener);
  }
}

export function relative(
  childRect: ClientRect,
  parentElement: Element | ClientRect
): Rect {
  const parentRect =
    "getBoundingClientRect" in parentElement
      ? parentElement.getBoundingClientRect()
      : parentElement;

  return new Rect({
    top: childRect.top - parentRect.top,
    right: childRect.right - parentRect.left,
    bottom: childRect.bottom - parentRect.top,
    left: childRect.left - parentRect.left,
    width: childRect.width,
    height: childRect.height,
  });
}
