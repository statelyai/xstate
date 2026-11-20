import type { EventObject } from 'xstate';

export const implicitInputTypes = Symbol('implicitInputTypes');

const receiveTimeoutMs = 1_000;

type Result<TEvent> =
  | { readonly type: 'event'; readonly event: TEvent }
  | { readonly type: 'error'; readonly cause: unknown };

interface Pending<TEvent> {
  readonly controller: AbortController;
  readonly result: Promise<Result<TEvent>>;
  ready?: Result<TEvent>;
}

export class SutReceiver<TEvent extends EventObject> {
  private pending?: Pending<TEvent>;

  constructor(
    private readonly receive: (context: {
      readonly signal: AbortSignal;
    }) => TEvent | Promise<TEvent>
  ) {}

  public listen(): void {
    if (this.pending) return;
    const controller = new AbortController();
    try {
      const result = Promise.resolve(
        this.receive({ signal: controller.signal })
      ).then<Result<TEvent>, Result<TEvent>>(
        (event) => (pending.ready = { type: 'event', event }),
        (cause) => (pending.ready = { type: 'error', cause })
      );
      const pending: Pending<TEvent> = { controller, result };
      this.pending = pending;
    } catch (cause) {
      const ready: Result<TEvent> = { type: 'error', cause };
      this.pending = { controller, ready, result: Promise.resolve(ready) };
    }
  }

  public async isReady(): Promise<boolean> {
    // Let an already resolved hook deliver its result before dispatching input.
    await Promise.resolve();
    return this.pending?.ready !== undefined;
  }

  public async take(wait: boolean): Promise<Result<TEvent> | undefined> {
    const pending = this.pending;
    if (!pending) return;
    if (!wait && !(await this.isReady())) return;
    if (this.pending !== pending) return;
    this.pending = undefined;
    if (pending.ready) return pending.ready;
    const timeout = new Error(
      `Timed out after ${receiveTimeoutMs}ms waiting for SUT output`
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        pending.result,
        new Promise<Result<TEvent>>((resolve) => {
          timer = setTimeout(() => {
            resolve({ type: 'error', cause: timeout });
            pending.controller.abort(timeout);
          }, receiveTimeoutMs);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  public stop(): void {
    this.pending?.controller.abort();
    this.pending = undefined;
  }
}
