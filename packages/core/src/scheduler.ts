interface SchedulerOptions {
  deferEvents: boolean;
}

const defaultOptions: SchedulerOptions = {
  deferEvents: false
};

export class Scheduler {
  private processingEvent: boolean = false;
  private queue: Array<() => void> = [];
  private initialized = false;

  // deferred feature
  private options: SchedulerOptions;

  constructor(options?: Partial<SchedulerOptions>) {
    this.options = { ...defaultOptions, ...options };
  }

  public initialize(callback?: () => void): void {
    this.initialized = true;

    if (callback) {
      if (!this.options.deferEvents) {
        this.schedule(callback);
        return;
      }

      this.process(callback);
    }

    this.flushEvents();
  }

  public schedule(task: () => void): void {
    if (!this.initialized || this.processingEvent) {
      this.queue.push(task);
      return;
    }

    if (this.queue.length !== 0) {
      throw new Error(
        'Event queue should be empty when it is not processing events'
      );
    }

    this.process(task);
    this.flushEvents();
  }

  public clear(): void {
    this.queue = [];
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
      this.clear();
      throw e;
    } finally {
      this.processingEvent = false;
    }
  }
}
