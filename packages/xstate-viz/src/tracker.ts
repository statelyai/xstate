interface TrackerData {
  rect: null | ClientRect;
  listeners: Set<TrackerListener>;
}

type TrackerListener = (data: TrackerData) => void;

class Tracker {
  public data: Record<string, TrackerData> = {};

  public update(id: string, el: Element) {
    const rect = el.getBoundingClientRect();

    if (!this.data[id]) {
      this.register(id);
    }

    const currentData = this.data[id];

    currentData.rect = {
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
      width: rect.width,
      height: rect.height
    };
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

export const tracker = new Tracker();
