import { Queue } from 'effect';
import type {
  ActorRef,
  AnyActor,
  AnyActorLogic,
  EmittedFrom,
  EventFromLogic,
  InspectionEvent,
  Observer,
  Snapshot,
  SnapshotFrom,
  Subscription
} from 'xstate';

/** A mailbox item that reports a failed fire-and-forget action. */
export interface ActionFailure {
  readonly [actionFailure]: true;
  readonly error: unknown;
}

export const actionFailure: unique symbol = Symbol.for(
  '@xstate/effect/actionFailure'
) as any;

export function isActionFailure(value: unknown): value is ActionFailure {
  return typeof value === 'object' && value !== null && actionFailure in value;
}

export type MailboxItem<TEvent> = TEvent | ActionFailure;

const symbolObservable: typeof Symbol.observable = (() =>
  (typeof Symbol === 'function' && Symbol.observable) ||
  '@@observable')() as any;

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

  constructor(
    readonly logic: TLogic,
    root: AnyActor,
    snapshot: SnapshotFrom<TLogic>,
    private readonly _mailbox: Queue.Queue<MailboxItem<EventFromLogic<TLogic>>>,
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

  getPersistedSnapshot(): Snapshot<unknown> {
    return this.logic.getPersistedSnapshot(this._snapshot as never);
  }

  /** Sends an event; the actor processes it on its own fiber. */
  send(event: EventFromLogic<TLogic>): void {
    if (this._settled) {
      this.system.deadLetter(undefined, this._root, event, 'stopped');
      return;
    }
    Queue.offerUnsafe(this._mailbox, event);
  }

  /** Stops the actor, its children and every Effect it hosts. */
  stop(): this {
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
        observer.error?.(snapshot.error);
      } else {
        observer.complete?.();
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
    const listeners = [
      ...(this._listeners.get(event.type) ?? []),
      ...(this._listeners.get('*') ?? [])
    ];
    for (const listener of listeners) {
      listener(event);
    }
  }

  /**
   * Observes the inspection events of this actor and its children: every
   * transition, event delivery and dead letter of the execution.
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

  toJSON() {
    return { xstate$$type: 1, id: this.id };
  }

  /** @internal Publishes a snapshot produced by the execution loop. */
  _publish(snapshot: SnapshotFrom<TLogic>): void {
    this._snapshot = snapshot;
    const status = (snapshot as Snapshot<unknown>).status;
    if (status === 'active') {
      for (const observer of this._observers) {
        observer.next?.(snapshot);
      }
      return;
    }
    this._settle(snapshot);
  }

  /** @internal Marks the actor stopped and notifies observers. */
  _settle(snapshot: SnapshotFrom<TLogic>): void {
    if (this._settled) {
      return;
    }
    this._snapshot = snapshot;
    this._settled = true;
    const observers = [...this._observers];
    this._observers.clear();
    const status = (snapshot as Snapshot<unknown>).status;
    if (status === 'done') {
      for (const observer of observers) {
        observer.next?.(snapshot);
      }
    }
    for (const observer of observers) {
      if (status === 'error') {
        observer.error?.((snapshot as Snapshot<unknown>).error);
      } else {
        observer.complete?.();
      }
    }
  }

  /** @internal */
  get _isSettled(): boolean {
    return this._settled;
  }
}
