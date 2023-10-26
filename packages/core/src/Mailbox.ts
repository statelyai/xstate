interface MailboxItem<T> {
  value: T;
  next: MailboxItem<T> | null;
}

export const MAILBOX_ACTIVE = 0;
export const MAILBOX_NOT_STARTED = 1;
export const MAILBOX_STOPPED = 2;

type MAILBOX_STATUS =
  | typeof MAILBOX_ACTIVE
  | typeof MAILBOX_NOT_STARTED
  | typeof MAILBOX_STOPPED;

export class Mailbox<T> {
  public status: MAILBOX_STATUS = MAILBOX_NOT_STARTED;
  private _current: MailboxItem<T> | null = null;
  private _last: MailboxItem<T> | null = null;

  constructor(private _process: (ev: T) => void) {}

  public clear(): void {
    // we can't set _current to null because we might be currently processing
    // and enqueue following clear shouldnt start processing the enqueued item immediately
    if (this._current) {
      this._current.next = null;
      this._last = this._current;
    }
  }

  public enqueue(event: T): void {
    const enqueued = {
      value: event,
      next: null
    };

    if (this._current) {
      this._last!.next = enqueued;
      this._last = enqueued;
      return;
    }

    this._current = enqueued;
    this._last = enqueued;

    if (!this.status) {
      this.flush();
    }
  }

  public flush() {
    while (this._current) {
      // atm the given _process is responsible for implementing proper try/catch handling
      // we assume here that this won't throw in a way that can affect this mailbox
      const consumed = this._current;
      this._process(consumed.value);
      this._current = consumed.next;
    }
    this._last = null;
  }
}
