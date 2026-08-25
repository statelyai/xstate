import type {
  ActorOptions,
  AnyActorLogic,
  EventFromLogic,
  InputFrom,
  Observer,
  SnapshotFrom
} from '../types.ts';

const enum FSMActorStatus {
  NotStarted,
  Running,
  Stopped
}

let nextSessionId = 0;

function addressSegment(id: string) {
  return id.replaceAll('%', '%25').replaceAll('/', '%2F');
}

const timerMaps = new WeakMap<object, Map<string, any>>();
const registryMaps = new WeakMap<object, Map<string, FSMActor<any>>>();

class FSMSystem {
  constructor(
    public readonly _clock: NonNullable<ActorOptions<any>['clock']>
  ) {}

  createActorRef(logic: AnyActorLogic, options: ActorOptions<any>) {
    return new FSMActor(logic, options);
  }
  spawnActor() {}
  startActor(actor: FSMActor<any>) {
    actor.start();
  }
  stopActor(actor: FSMActor<any>) {
    actor._stop();
  }
  terminateActor(actor: FSMActor<any>, termination: any) {
    actor._terminate(termination);
  }
  emitEvent(source: FSMActor<any>, event: any) {
    source._emit(event);
  }
  sendEvent(_: unknown, target: FSMActor<any>, event: any) {
    target._send(event);
  }
  _relay(source: unknown, target: FSMActor<any>, event: any) {
    this.sendEvent(source, target, event);
  }
  scheduleTimer(source: FSMActor<any>, id: string, delay: number) {
    let actorTimers = timerMaps.get(source);
    if (!actorTimers) {
      actorTimers = new Map();
      timerMaps.set(source, actorTimers);
    }
    actorTimers.set(
      id,
      this._clock.setTimeout(() => {
        actorTimers!.delete(id);
        source._send({ type: 'xstate.timer', id } as any);
      }, delay)
    );
  }
  cancelTimer(source: FSMActor<any>, id: string) {
    const actorTimers = timerMaps.get(source);
    const timeout = actorTimers?.get(id);
    if (timeout !== undefined) {
      this._clock.clearTimeout(timeout);
      actorTimers!.delete(id);
    }
  }
  cancelAllTimers(source: FSMActor<any>) {
    const actorTimers = timerMaps.get(source);
    for (const timeout of actorTimers?.values() ?? []) {
      this._clock.clearTimeout(timeout);
    }
    actorTimers?.clear();
  }
  _set(key: string, actor: FSMActor<any>) {
    let registry = registryMaps.get(this);
    if (!registry) {
      registry = new Map();
      registryMaps.set(this, registry);
    }
    registry.set(key, actor);
  }
  get(key: string) {
    return registryMaps.get(this)?.get(key);
  }
  getAll() {
    return Object.fromEntries(registryMaps.get(this) ?? []);
  }
  _unregister(actor: FSMActor<any>) {
    const registry = registryMaps.get(this);
    for (const [key, value] of registry ?? []) {
      if (value === actor) {
        registry!.delete(key);
      }
    }
  }
}

/** A compact actor runtime for logic returned by `createFSM(...)`. */
export class FSMActor<TLogic extends AnyActorLogic> {
  private _snapshot: SnapshotFrom<TLogic>;
  private _effects: any[];
  private _queue: EventFromLogic<TLogic>[] | undefined;
  private _processing = false;
  private _observers: Set<Observer<SnapshotFrom<TLogic>>> | undefined;
  private _listeners: Map<string, Set<(event: any) => void>> | undefined;
  private _trigger: any;
  private _restored = false;

  public _processingStatus: any = FSMActorStatus.NotStarted;
  public readonly id: string;
  public readonly sessionId: string;
  public readonly address: string;
  public readonly ref = this;
  public readonly src: string | AnyActorLogic;
  public readonly system: any;
  public readonly _parent: any;

  constructor(
    public readonly logic: TLogic,
    private readonly options: ActorOptions<TLogic> = {}
  ) {
    this.id = options.id ?? (logic as { id?: string }).id ?? '(fsm)';
    this.sessionId = options._sessionId ?? `fsm:${nextSessionId++}`;
    this.src = options.src ?? logic;
    this._parent = options.parent;
    this.address = this._parent
      ? `${this._parent.address}/${addressSegment(this.id)}`
      : addressSegment(this.id);
    this.system =
      this._parent?.system ??
      new FSMSystem(options.clock ?? { setTimeout, clearTimeout });
    if (options.registryKey) {
      this.system._set(options.registryKey, this);
    }

    const persisted = options.snapshot ?? options.state;
    try {
      if (persisted !== undefined) {
        this._restored = true;
        this._snapshot = (logic.restoreSnapshot?.(persisted, this as any) ??
          persisted) as SnapshotFrom<TLogic>;
        this._effects = [];
      } else {
        [this._snapshot, this._effects] = logic.initialTransition(
          options.input,
          this as any
        );
      }
    } catch (error) {
      this._snapshot = {
        status: 'error',
        output: undefined,
        error
      } as SnapshotFrom<TLogic>;
      this._effects = [];
    }
  }

  private get self() {
    return this;
  }

  private get logger() {
    return this.options.logger ?? console.log;
  }

  private defer(fn: () => void) {
    fn();
  }

  private get emit() {
    const emit = (event: any) => this.system.emitEvent(this, event);
    Object.defineProperty(this, 'emit', { value: emit });
    return emit;
  }

  private stopChild(child: { stop(): void }) {
    (child as FSMActor<any>)._stop();
  }

  private actionExecutor(effect: { exec(): void }) {
    effect.exec();
  }

  public start(): this {
    if (this._processingStatus !== FSMActorStatus.NotStarted) {
      return this;
    }
    this._processingStatus = FSMActorStatus.Running;
    try {
      this.runEffects(this._effects);
    } catch (error) {
      this.fail(error);
      return this;
    }
    if ((this._snapshot as any).status === 'error') {
      this.fail((this._snapshot as any).error);
      return this;
    }
    this._effects = [];
    if (this._processingStatus === FSMActorStatus.Stopped) {
      return this;
    }
    try {
      this.logic.start?.(this._snapshot, this as any, {
        restored: this._restored
      });
    } catch (error) {
      this.fail(error);
      return this;
    }
    if (this._restored) {
      const timers = (this._snapshot as any).timers ?? {};
      for (const timer of Object.values(timers) as Array<{
        id: string;
        delay: number;
        startedAt?: number;
      }>) {
        const delay =
          !this.system._clock.now && timer.startedAt !== undefined
            ? Math.min(
                timer.delay,
                Math.max(0, timer.startedAt + timer.delay - Date.now())
              )
            : timer.delay;
        this.system.scheduleTimer(this, timer.id, delay);
      }
      this._restored = false;
    }
    this.notify();
    this.flush();
    return this;
  }

  public send(event: EventFromLogic<TLogic>): void {
    if (this._processingStatus === FSMActorStatus.Stopped) {
      return;
    }
    (this._queue ??= []).push(event);
    this.flush();
  }

  public _send(event: EventFromLogic<TLogic>): void {
    this.send(event);
  }

  private flush(): void {
    if (
      this._processing ||
      this._processingStatus !== FSMActorStatus.Running ||
      !this._queue?.length
    ) {
      return;
    }

    this._processing = true;
    let event: EventFromLogic<TLogic> | undefined;
    while (
      this._processingStatus === FSMActorStatus.Running &&
      (event = this._queue?.shift())
    ) {
      try {
        const [snapshot, effects] = this.logic.transition(
          this._snapshot,
          event,
          this as any
        );
        this._snapshot = snapshot;
        this.runEffects(effects);
        if ((this._snapshot as any).status === 'active') {
          this.notify();
        }
      } catch (error) {
        this.fail(error);
        break;
      }
    }
    this._processing = false;
  }

  private runEffects(effects: readonly { exec(): void }[]) {
    for (const effect of effects) {
      effect.exec();
    }
  }

  public getSnapshot(): SnapshotFrom<TLogic> {
    return this._snapshot;
  }

  public getPersistedSnapshot(options?: unknown) {
    return this.logic.getPersistedSnapshot(this._snapshot, options);
  }

  public toJSON() {
    return {
      xstate$type: 'actorRef',
      id: this.id,
      address: this.address,
      src: typeof this.src === 'string' ? this.src : undefined
    };
  }

  public _stop(): this {
    if (this._processingStatus === FSMActorStatus.Stopped) {
      return this;
    }
    if (this._processingStatus === FSMActorStatus.Running) {
      const [snapshot, effects] = this.logic.transition(
        this._snapshot,
        { type: '@xstate.stop' },
        this as any
      );
      this._snapshot = snapshot;
      this.runEffects(effects);
    }
    this._processingStatus = FSMActorStatus.Stopped;
    this.system.cancelAllTimers(this);
    this.system._unregister(this);
    this._queue = undefined;
    for (const observer of this._observers ?? []) {
      observer.complete?.();
    }
    this._observers?.clear();
    return this;
  }

  public stop(): this {
    if (this._parent) {
      throw new Error('A non-root actor cannot be stopped directly.');
    }
    return this._stop();
  }

  public subscribe(
    observerOrNext?:
      | Observer<SnapshotFrom<TLogic>>
      | ((snapshot: SnapshotFrom<TLogic>) => void),
    error?: (error: unknown) => void,
    complete?: () => void
  ) {
    const observer: Observer<SnapshotFrom<TLogic>> =
      typeof observerOrNext === 'function'
        ? { next: observerOrNext, error, complete }
        : (observerOrNext ?? {});
    if (this._processingStatus === FSMActorStatus.Stopped) {
      const snapshot = this._snapshot as any;
      if (snapshot.status === 'done') {
        observer.complete?.();
      } else if (snapshot.status === 'error') {
        observer.error?.(snapshot.error);
      }
      return { unsubscribe() {} };
    }
    (this._observers ??= new Set()).add(observer);
    return { unsubscribe: () => this._observers?.delete(observer) };
  }

  public on(type: string, handler: (event: any) => void) {
    let listeners = this._listeners?.get(type);
    if (!listeners) {
      listeners = new Set();
      (this._listeners ??= new Map()).set(type, listeners);
    }
    listeners.add(handler);
    return { unsubscribe: () => listeners.delete(handler) };
  }

  public _emit(event: any): void {
    for (const listeners of [
      this._listeners?.get(event.type),
      this._listeners?.get('*')
    ]) {
      for (const listener of listeners ?? []) {
        listener(event);
      }
    }
  }

  public _terminate(termination: any): void {
    this.notify();
    this._processingStatus = FSMActorStatus.Stopped;
    this.system.cancelAllTimers(this);
    this.system._unregister(this);
    for (const observer of this._observers ?? []) {
      if (termination.status === 'error') {
        observer.error?.(termination.error);
      } else {
        observer.complete?.();
      }
    }
    this._observers?.clear();
    this._listeners?.clear();
  }

  private fail(error: unknown): void {
    this._snapshot = {
      ...(this._snapshot as any),
      status: 'error',
      output: undefined,
      error
    };
    this._processingStatus = FSMActorStatus.Stopped;
    this.system.cancelAllTimers(this);
    this.system._unregister(this);
    this._queue = undefined;
    for (const observer of this._observers ?? []) {
      observer.error?.(error);
    }
    this._observers?.clear();
    this._listeners?.clear();
  }

  private notify(): void {
    for (const observer of this._observers ?? []) {
      observer.next?.(this._snapshot);
    }
  }

  public _isRunning(): boolean {
    return this._processingStatus === FSMActorStatus.Running;
  }

  public _inspectTransition(): void {}

  public get trigger(): any {
    return (this._trigger ??= new Proxy(
      {},
      {
        get: (_, type: string) => (payload?: object) =>
          this.send({ ...payload, type } as EventFromLogic<TLogic>)
      }
    ));
  }

  public select<T>(
    selector: (snapshot: SnapshotFrom<TLogic>) => T,
    equal: (a: T, b: T) => boolean = Object.is
  ) {
    return {
      get: () => selector(this._snapshot),
      subscribe: (observerOrNext: Observer<T> | ((value: T) => void)) => {
        const observer: Observer<T> =
          typeof observerOrNext === 'function'
            ? { next: observerOrNext }
            : observerOrNext;
        let selected = selector(this._snapshot);
        return this.subscribe({
          next: (snapshot) => {
            const next = selector(snapshot);
            if (!equal(selected, next)) {
              selected = next;
              observer.next?.(next);
            }
          },
          error: observer.error,
          complete: observer.complete
        });
      }
    };
  }

  public [Symbol.observable]() {
    return this;
  }
}

export function createFSMActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options?: ActorOptions<TLogic> & {
    [K in undefined extends InputFrom<TLogic> ? never : 'input']: unknown;
  }
): FSMActor<TLogic> {
  return new FSMActor(logic, options);
}
