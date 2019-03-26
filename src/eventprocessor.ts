export class EventProcessor {
  private processingEvent: boolean = false;
  private queue: Array<() => void> = [];

  // deferred feature
  private deferredStartupCalled: boolean = false;
  private deferredStartup: boolean = false;
  private initCalled: boolean = false;

  public initialize(callback: () => void): void {
    this.initCalled = true;

    if (!this.deferredStartup) {
      this.processEvent(callback);
      return;
    }

    this.deferredStartup = false;
    this.process(callback);
    this.flushEvents();
  }

  public setDeferredStartup(useDeferredStartup: boolean): void {
    if (this.deferredStartupCalled) {
      throw new Error(
        'Can only be called once during the lifetime of the EventProcessor'
      );
    }
    if (this.initCalled) {
      throw new Error(
        'Events can be deferred only before .start() method has not been called'
      );
    }

    this.deferredStartupCalled = true;
    this.deferredStartup = useDeferredStartup;
  }

  public processEvent(callback: () => void): void {
    if (this.processingEvent || this.deferredStartup) {
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
