export class EventProcessor {
    private processingEvent: boolean = false;
    private queue: (() => void)[] = [];

    public processEvent(callback: () => void): any {
        if (this.processingEvent) {
            this.queue.push(callback);
            return;
        }

        this.ProcessSingleEvent(callback);

        let nextCallback : (() => void) | undefined;
        while(nextCallback = this.queue.shift()) {
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