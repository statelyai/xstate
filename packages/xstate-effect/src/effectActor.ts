import { Effect, Exit, Queue } from 'effect';
import { ActorStoppedError, EventRejectedError } from './errors.ts';
import { StateMachine } from 'xstate';
import type {
  ActorRef,
  AnyActor,
  AnyActorLogic,
  EmittedFrom,
  EventFromLogic,
  InspectionEvent,
  Observer,
  PersistedSnapshotOf,
  Snapshot,
  SnapshotFrom,
  Subscription
} from 'xstate';

export interface Receipt<TSnapshot> {
  resume?: (
    exit: Exit.Exit<TSnapshot, ActorStoppedError | EventRejectedError>
  ) => void;
}

export type MailboxItem<TEvent, TSnapshot> =
  | {
      readonly kind: 'event';
      readonly event: TEvent;
      readonly receipt?: Receipt<TSnapshot>;
    }
  | { readonly kind: 'actionFailure'; readonly error: unknown };

/** @internal */
export type Step<TSnapshot> =
  | {
      readonly kind: 'start';
      readonly snapshot: TSnapshot;
      readonly effects: Effect.Effect<void>;
    }
  | {
      readonly kind: 'transition';
      readonly snapshot: TSnapshot;
      readonly effects: Effect.Effect<void>;
      readonly receipt?: Receipt<TSnapshot>;
      readonly rejection?: EventRejectedError;
    };

const symbolObservable: typeof Symbol.observable = (() =>
  (typeof Symbol === 'function' && Symbol.observable) ||
  '@@observable')() as any;

/**
 * Calls a listener and reports an exception it throws without letting it
 * escape into the interpreter, matching core's `safeCall`.
 */
export function safeCall<T>(fn: ((arg: T) => void) | undefined, arg?: T) {
  try {
    fn?.(arg as T);
  } catch (err) {
    setTimeout(() => {
      throw err;
    });
  }
}

function toObserver<T>(
  nextHandler?: Observer<T> | ((value: T) => void),
  errorHandler?: (error: any) => void,
  completionHandler?: () => void
): Observer<T> {
  if (typeof nextHandler === 'object') {
    return nextHandler;
  }
  return {
    next: nextHandler,
    error: errorHandler,
    complete: completionHandler
  };
}

/**
 * The handle `createEffectActor` returns. It implements XState's `ActorRef`
 * contract (`send`, `getSnapshot`, `subscribe`, `on`), so it works with
 * `useSelector`, this package's actor functions and the inspection APIs, while
 * the actor itself is driven by an Effect fiber over pure transitions.
 *
 * @experimental
 */
export class EffectActor<TLogic extends AnyActorLogic> implements ActorRef<
  SnapshotFrom<TLogic>,
  EventFromLogic<TLogic>,
  EmittedFrom<TLogic>
> {
  readonly id: string;
  readonly address: string;
  readonly sessionId: string | undefined;
  /** The actor system that hosts this actor and its children. */
  readonly system: AnyActor['system'];
  /** @internal */
  readonly _root: AnyActor;

  private _snapshot: SnapshotFrom<TLogic>;
  private readonly _observers = new Set<Observer<SnapshotFrom<TLogic>>>();
  private readonly _listeners = new Map<
    string,
    Set<(emitted: EmittedFrom<TLogic>) => void>
  >();
  private _settled = false;
  private readonly _pending = new Set<Receipt<SnapshotFrom<TLogic>>>();
  private _inStep = false;
  private _deliveryDepth = 0;
  private _stopHeld = false;

  constructor(
    readonly logic: TLogic,
    root: AnyActor,
    snapshot: SnapshotFrom<TLogic>,
    private readonly _mailbox: Queue.Queue<
      MailboxItem<EventFromLogic<TLogic>, SnapshotFrom<TLogic>>
    >,
    private readonly _stopExecution: () => void,
    private readonly _inspectors: Set<(event: InspectionEvent) => void>
  ) {
    this._root = root;
    this.id = root.id;
    this.address = root.address;
    this.sessionId = root.sessionId;
    this.system = root.system;
    this._snapshot = snapshot;
  }

  getSnapshot(): SnapshotFrom<TLogic> {
    return this._snapshot;
  }

  getPersistedSnapshot(): PersistedSnapshotOf<TLogic> {
    return this.logic.getPersistedSnapshot(
      this._snapshot as never
    ) as PersistedSnapshotOf<TLogic>;
  }

  /** Sends an event; the actor processes it on its own fiber. */
  send(event: EventFromLogic<TLogic>): void {
    if (this._deliveryError(event)) return;
    Queue.offerUnsafe(this._mailbox, { kind: 'event', event });
  }

  /** @internal */
  _sendAndAwait(
    event: EventFromLogic<TLogic>
  ): Effect.Effect<
    SnapshotFrom<TLogic>,
    ActorStoppedError | EventRejectedError
  > {
    return Effect.callback((resume) => {
      const error = this._deliveryError(event);
      if (error) {
        resume(Effect.fail(error));
        return;
      }
      const receipt: Receipt<SnapshotFrom<TLogic>> = {
        resume: (exit) => resume(exit)
      };
      this._pending.add(receipt);
      Queue.offerUnsafe(this._mailbox, { kind: 'event', event, receipt });
      return Effect.sync(() => {
        this._pending.delete(receipt);
        receipt.resume = undefined;
      });
    });
  }

  private _deliveryError(
    event: EventFromLogic<TLogic>
  ): ActorStoppedError | EventRejectedError | undefined {
    if (this._settled) {
      this.system.deadLetter(undefined, this._root, event, 'stopped');
      return this._stoppedError();
    }
    if (
      this.logic instanceof StateMachine &&
      this.logic.isInternalEventType(event.type)
    ) {
      this.system.deadLetter(undefined, this._root, event, 'internalEvent');
      return new EventRejectedError({
        actorId: this.id,
        event,
        reason: 'internalEvent'
      });
    }
    return undefined;
  }

  private _stoppedError(): ActorStoppedError {
    return new ActorStoppedError({
      actorId: this.id,
      snapshot: this._snapshot
    });
  }

  /** @internal */
  _completeReceipt(
    receipt: Receipt<SnapshotFrom<TLogic>> | undefined,
    exit: Exit.Exit<
      SnapshotFrom<TLogic>,
      ActorStoppedError | EventRejectedError
    >
  ): void {
    if (!receipt || !this._pending.delete(receipt)) return;
    const resume = receipt.resume;
    receipt.resume = undefined;
    resume?.(exit);
  }

  /**
   * Stops the actor, its children and every Effect it hosts. If a listener or
   * an observer calls `stop()` while the actor delivers a macrostep to it, the
   * actor stops when that macrostep ends. `createActor` does the same.
   */
  stop(): this {
    if (this._inStep && this._deliveryDepth > 0) {
      this._stopHeld = true;
      return this;
    }
    this._stopExecution();
    return this;
  }

  subscribe(observer: Observer<SnapshotFrom<TLogic>>): Subscription;
  subscribe(
    nextListener?: (snapshot: SnapshotFrom<TLogic>) => void,
    errorListener?: (error: any) => void,
    completeListener?: () => void
  ): Subscription;
  subscribe(
    nextListenerOrObserver?:
      | ((snapshot: SnapshotFrom<TLogic>) => void)
      | Observer<SnapshotFrom<TLogic>>,
    errorListener?: (error: any) => void,
    completeListener?: () => void
  ): Subscription {
    const observer = toObserver(
      nextListenerOrObserver,
      errorListener,
      completeListener
    );
    if (this._settled) {
      const snapshot = this._snapshot as Snapshot<unknown>;
      if (snapshot.status === 'error') {
        safeCall(observer.error, snapshot.error);
      } else {
        safeCall(observer.complete);
      }
      return { unsubscribe: () => {} };
    }
    this._observers.add(observer);
    return {
      unsubscribe: () => {
        this._observers.delete(observer);
      }
    };
  }

  on<TType extends EmittedFrom<TLogic>['type'] | '*'>(
    type: TType,
    handler: (
      emitted: EmittedFrom<TLogic> &
        (TType extends '*' ? unknown : { type: TType })
    ) => void
  ): Subscription {
    let listeners = this._listeners.get(type);
    if (!listeners) {
      listeners = new Set();
      this._listeners.set(type, listeners);
    }
    const listener = handler as (emitted: EmittedFrom<TLogic>) => void;
    listeners.add(listener);
    return {
      unsubscribe: () => {
        listeners.delete(listener);
      }
    };
  }

  /** @internal Delivers an emitted event to `on` listeners. */
  _emit(event: EmittedFrom<TLogic>): void {
    if (this._settled) return;
    const listeners = [
      ...(this._listeners.get(event.type) ?? []),
      ...(this._listeners.get('*') ?? [])
    ];
    this._deliver(() => {
      for (const listener of listeners) {
        safeCall(listener, event);
      }
    });
  }

  private _deliver(notify: () => void): void {
    this._deliveryDepth++;
    try {
      notify();
    } finally {
      this._deliveryDepth--;
    }
  }

  /**
   * Observes the inspection events of this actor and its children: every
   * actor creation and transition of the execution.
   */
  inspect(
    observer: Observer<InspectionEvent> | ((event: InspectionEvent) => void)
  ): Subscription {
    const handler =
      typeof observer === 'function'
        ? observer
        : (event: InspectionEvent) => observer.next?.(event);
    this._inspectors.add(handler);
    return {
      unsubscribe: () => {
        this._inspectors.delete(handler);
      }
    };
  }

  [symbolObservable]() {
    return this;
  }

  toJSON(): { '@actor': string } {
    return { '@actor': this.address };
  }

  /** @internal */
  _runStep(step: Step<SnapshotFrom<TLogic>>): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      if (this._settled) return;
      this._snapshot = step.snapshot;
      this._inStep = true;
      yield* step.effects;
      if (this._settled) return;
      if ((this._snapshot as Snapshot<unknown>).status !== 'active') {
        this._settle(
          this._snapshot,
          step.kind === 'transition' ? step.receipt : undefined
        );
      } else if (step.kind === 'transition') {
        this._deliver(() => {
          for (const observer of this._observers) {
            safeCall(observer.next, this._snapshot);
          }
        });
      }
    }).pipe(
      Effect.onExit((exit) =>
        Effect.sync(() => {
          this._inStep = false;
          if (this._stopHeld) {
            this._stopExecution();
          } else if (step.kind === 'transition' && Exit.isSuccess(exit)) {
            this._completeReceipt(
              step.receipt,
              step.rejection
                ? Exit.fail(step.rejection)
                : Exit.succeed(step.snapshot)
            );
          }
        })
      )
    );
  }

  /** @internal Settles the actor and notifies its observers. */
  _settle(
    snapshot: SnapshotFrom<TLogic>,
    processing?: Receipt<SnapshotFrom<TLogic>>
  ): void {
    if (this._settled) {
      return;
    }
    this._snapshot = snapshot;
    this._settled = true;
    const observers = [...this._observers];
    this._observers.clear();
    const status = (snapshot as Snapshot<unknown>).status;
    this._deliver(() => {
      if (status === 'done') {
        for (const observer of observers) {
          safeCall(observer.next, snapshot);
        }
      }
      for (const observer of observers) {
        if (status === 'error') {
          safeCall(observer.error, (snapshot as Snapshot<unknown>).error);
        } else {
          safeCall(observer.complete);
        }
      }
    });
    this._completeReceipt(processing, Exit.succeed(snapshot));
    for (const receipt of this._pending) {
      this._completeReceipt(receipt, Exit.fail(this._stoppedError()));
    }
  }

  /** @internal */
  get _isSettled(): boolean {
    return this._settled;
  }
}
