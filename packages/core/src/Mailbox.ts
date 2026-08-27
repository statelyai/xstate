interface MailboxItem<T> {
  value: T;
  next: MailboxItem<T> | null;
}

export class Mailbox<T> {
  private a: boolean = false;
  private c: MailboxItem<T> | null = null;
  private l: MailboxItem<T> | null = null;

  constructor(private _process: (ev: T) => void) {}

  public start() {
    this.a = true;
    this.f();
  }

  public clear(): void {
    // we can't set c to null because we might be currently processing
    // and enqueue following clear shouldn't start processing the enqueued item immediately
    if (this.c) {
      this.c.next = null;
      this.l = this.c;
    }
  }

  public enqueue(event: T): void {
    const enqueued = {
      value: event,
      next: null
    };

    if (this.c) {
      this.l!.next = enqueued;
      this.l = enqueued;
      return;
    }

    this.c = enqueued;
    this.l = enqueued;

    if (this.a) {
      this.f();
    }
  }

  private f() {
    while (this.c) {
      // atm the given _process is responsible for implementing proper try/catch handling
      // we assume here that this won't throw in a way that can affect this mailbox
      const consumed = this.c;
      this._process(consumed.value);
      this.c = consumed.next;
    }
    this.l = null;
  }
}
