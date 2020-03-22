export interface TrackerData {
  rect: null | Rect;
  listeners: Set<TrackerListener>;
}

type TrackerListener = (data: TrackerData) => void;

export interface Point {
  x: number;
  y: number;
}

class Rect implements ClientRect {
  public top: number;
  public left: number;
  public bottom: number;
  public right: number;
  public width: number;
  public height: number;
  public x: number;
  public y: number;
  constructor(rect: ClientRect) {
    this.top = rect.top;
    this.left = rect.left;
    this.bottom = rect.bottom;
    this.right = rect.right;
    this.width = rect.width;
    this.height = rect.height;
    this.x = rect.left;
    this.y = rect.top;
  }

  public point(x: string, y: string): Point {
    const point: Point = { x: 0, y: 0 };

    switch (x) {
      case 'left':
        point.x = this.left;
        break;
      case 'right':
        point.x = this.right;
        break;

      case 'center':
        point.x = this.left + this.width / 2;
        break;
      default:
        break;
    }
    switch (y) {
      case 'top':
        point.y = this.top;
        break;
      case 'bottom':
        point.y = this.bottom;
        break;

      case 'center':
        point.y = this.top + this.height / 2;
        break;
      default:
        break;
    }

    return point;
  }
}

class Tracker {
  public data: Record<string, TrackerData> = {};

  public update(id: string, el: Element) {
    const clientRect = el.getBoundingClientRect();

    if (!this.data[id]) {
      this.register(id);
    }

    const currentData = this.data[id];

    currentData.rect = new Rect(clientRect);
    currentData.listeners.forEach(listener => {
      listener(currentData);
    });
  }

  public register(id: string) {
    this.data[id] = {
      rect: null,
      listeners: new Set()
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

const tracker = new Tracker();

export function relative(
  childRect: ClientRect,
  parentElement: Element | ClientRect
): Rect {
  const parentRect =
    'getBoundingClientRect' in parentElement
      ? parentElement.getBoundingClientRect()
      : parentElement;

  return new Rect({
    top: childRect.top - parentRect.top,
    right: childRect.right - parentRect.left,
    bottom: childRect.bottom - parentRect.top,
    left: childRect.left - parentRect.left,
    width: childRect.width,
    height: childRect.height
  });
}

export { tracker };
