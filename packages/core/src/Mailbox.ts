interface MailboxItem<T> {
  value: T;
  next: MailboxItem<T> | null;
}

export class Mailbox<T> {
  private _active: boolean = false;
  private _current: MailboxItem<T> | null = null;
  private _last: MailboxItem<T> | null = null;
  private _deferred: Array<() => void> | undefined;
  private _processing = false;
  private _flushingDeferred = false;

  constructor(private _process: (ev: T) => void) {}

  public start() {
    this._active = true;
    this.flush();
  }

  public clear(): void {
    // we can't set _current to null because we might be currently processing
    // and enqueue following clear shouldn't start processing the enqueued item immediately
    if (this._current && this._processing) {
      this._current.next = null;
      this._last = this._current;
    } else {
      this._current = null;
      this._last = null;
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

    if (this._active) {
      this.flush();
    }
  }

  public defer(fn: () => void): void {
    if (this._processing || this._flushingDeferred) {
      (this._deferred ??= []).push(fn);
    } else {
      fn();
    }
  }

  private flush() {
    while (this._current) {
      // atm the given _process is responsible for implementing proper try/catch handling
      // we assume here that this won't throw in a way that can affect this mailbox
      const consumed = this._current;
      this._processing = true;
      try {
        this._process(consumed.value);
      } finally {
        this._processing = false;
      }
      this._current = consumed.next;
      if (!this._current) {
        this._last = null;
      }
      if (!this._flushingDeferred && this._deferred) {
        this._flushingDeferred = true;
        try {
          for (let i = 0; i < this._deferred.length; i++) {
            this._deferred[i]();
          }
        } finally {
          this._deferred = undefined;
          this._flushingDeferred = false;
        }
      }
    }
    this._last = null;
  }
}
