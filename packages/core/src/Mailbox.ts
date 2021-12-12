export class Mailbox<T> {
  private events: T[] = [];
  private index: number = 0;

  public status: 'deferred' | 'idle' | 'processing' = 'deferred';

  public get size(): number {
    return this.events.length - this.index;
  }

  public clear(): void {
    this.events.length = 0;
    this.index = 0;
  }

  public enqueue(event: T): void {
    this.events.push(event);
  }

  public dequeue(): T | undefined {
    const event = this.events[this.index];

    if (!event) {
      return undefined;
    }

    this.index++;

    if (this.index > this.events.length - 1) {
      this.events.length = 0;
      this.index = 0;
    }

    return event;
  }
}
