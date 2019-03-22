export class EventProcessor {
    private processingEvent: boolean = false;
    private queue: (() => void)[] = [];

    // deferred feature
    private deferredStartupCalled: boolean = false;
    private deferredStartup: boolean = false;
    private initCalled: boolean = false;

    public Initialize(callback: () => void): void {
        this.initCalled = true;
        if (!this.deferredStartup) {
            this.processEvent(callback);
            return;
        }
        this.deferredStartup = false;
        this.ProcessSingleEvent(callback);
        this.ProcessQueue();
    }

    public setDeferredStartup(useDeferredStartup: boolean): void {
        if (this.deferredStartupCalled) {
            throw new Error("Can only be called once during the lifetime of the EventProcessor");
        }
        if (this.initCalled) {
            throw new Error("Events can be deferred only before .start() method has not been called");
        }
        this.deferredStartup = useDeferredStartup;
    }

    public processEvent(callback: () => void): void {
        if (this.processingEvent || this.deferredStartup) {
            this.queue.push(callback);
            return;
        }

        if (this.queue.length !== 0) {
            throw new Error("Event queue should be empty when it is not processing events");
        }

        this.ProcessSingleEvent(callback);

        this.ProcessQueue();
    }

    private ProcessQueue() {
        let nextCallback: (() => void) | undefined;
        while (nextCallback = this.queue.shift()) {
            this.ProcessSingleEvent(nextCallback);
        }
    }

    private ProcessSingleEvent(callback: () => void) {
        this.processingEvent = true;
        try {
            callback();
        } catch (e) {
            // there is no use to keep the future events
            // as the situation is not anymore the same
            this.queue = [];
            throw e;
        }
        finally {
            this.processingEvent = false;
        }
    }
}