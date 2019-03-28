interface EventProcessorOptions {
  deferEvents: boolean;
}

const defaultOptions: EventProcessorOptions = {
  deferEvents: false
};

export class EventProcessor {
  private processingEvent: boolean = false;
  private queue: Array<() => void> = [];
  private initialized = false;

  // deferred feature
  private options: EventProcessorOptions;

  constructor(options?: Partial<EventProcessorOptions>) {
    this.options = { ...defaultOptions, ...options };
  }

  public initialize(callback?: () => void): void {
    this.initialized = true;

    if (callback) {
      if (!this.options.deferEvents) {
        this.processEvent(callback);
        return;
      }

      this.process(callback);
    }

    this.flushEvents();
  }

  public processEvent(callback: () => void): void {
    if (!this.initialized || this.processingEvent) {
      this.queue.push(callback);
      return;
    }

    if (this.queue.length !== 0) {
      throw new Error(
        'Event queue should be empty when it is not processing events'
      );
    }

    this.process(callback);
    this.flushEvents();
  }

  private flushEvents() {
    let nextCallback: (() => void) | undefined = this.queue.shift();
    while (nextCallback) {
      this.process(nextCallback);
      nextCallback = this.queue.shift();
    }
  }

  private process(callback: () => void) {
    this.processingEvent = true;
    try {
      callback();
    } catch (e) {
      // there is no use to keep the future events
      // as the situation is not anymore the same
      this.queue = [];
      throw e;
    } finally {
      this.processingEvent = false;
    }
  }
}
