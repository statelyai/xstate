import {
  createReactiveSystem,
  type ReactiveNode,
  ReactiveFlags
} from './alien.ts';
import {
  AnyAtom,
  Atom,
  AtomConfig,
  AtomOptions,
  Observer,
  ReducerAtom,
  ReadonlyAtom,
  Subscription,
  SourceAtomConfig
} from './types.ts';

/** Returns `true` if `value` is an atom (has `get` and `subscribe` methods). */
export function isAtom(value: unknown): value is AnyAtom {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).get === 'function' &&
    typeof (value as any).subscribe === 'function'
  );
}

interface ObservedNode extends ReactiveNode {
  _observers?: number;
  _observedDeps?: Set<ObservedNode>;
  _activate?: () => void;
  _deactivate?: () => void;
}

interface InternalAtom<T> extends ObservedNode {
  _snapshot: T;
  _update(getValue?: T | ((snapshot: T) => T)): boolean;
  get(): T;
  subscribe(observerOrFn: Observer<T> | ((value: T) => void)): Subscription;
}

// Observation follows live subscriptions, independently of cached dependency links.
const pendingObservedNodes = new Set<ObservedNode>();
const pendingSources = new Set<ObservedNode>();
let operationDepth = 0;
let settlingSources = false;
// Source-only hooks let applications using ordinary atoms tree-shake lifecycle
// reconciliation. Existing subscription effects activate on their next run.
let observeNode: typeof observe | undefined;
let scheduleObservedNode: ((node: ObservedNode) => void) | undefined;
let settleObservedGraph: (() => void) | undefined;

function observe(node: ObservedNode, change: number): void {
  node._observers = (node._observers ?? 0) + change;
  pendingObservedNodes.add(node);
}

function settleSources(): void {
  if (operationDepth || settlingSources) {
    return;
  }
  settlingSources = true;
  let didThrow = false;
  let firstError: unknown;
  const failedSources = new Set<ObservedNode>();
  try {
    while (pendingObservedNodes.size || pendingSources.size) {
      // Reconcile the entire changed graph before starting or stopping resources.
      for (const node of pendingObservedNodes) {
        pendingObservedNodes.delete(node);
        const previous = node._observedDeps;
        const next = new Set<ObservedNode>();
        if (node._observers) {
          for (let link = node.deps; link; link = link.nextDep) {
            next.add(link.dep as ObservedNode);
          }
        }
        node._observedDeps = next.size ? next : undefined;
        for (const dep of previous ?? []) {
          if (!next.has(dep)) {
            observe(dep, -1);
          }
        }
        for (const dep of next) {
          if (!previous?.has(dep)) {
            observe(dep, 1);
          }
        }
        if (node._activate) {
          pendingSources.add(node);
        }
      }
      const node = pendingSources.values().next().value;
      if (node) {
        pendingSources.delete(node);
        if (failedSources.has(node) && node._observers) {
          continue;
        }
        try {
          if (node._observers) {
            node._activate!();
          } else {
            node._deactivate!();
          }
        } catch (error) {
          if (node._observers) {
            failedSources.add(node);
          }
          if (!didThrow) {
            didThrow = true;
            firstError = error;
          }
        }
      }
    }
  } finally {
    // Keep live failures eligible for the next operation, never this pass.
    for (const node of failedSources) {
      if (node._observers) {
        pendingSources.add(node);
      }
    }
    settlingSources = false;
  }
  if (didThrow) {
    throw firstError;
  }
}

function atomOperation<T>(fn: () => T): T {
  ++operationDepth;
  try {
    return fn();
  } finally {
    if (!--operationDepth) {
      settleObservedGraph?.();
    }
  }
}

const queuedEffects: (Effect | undefined)[] = [];
let cycle = 0;
const { link, unlink, propagate, checkDirty, shallowPropagate } =
  createReactiveSystem({
    update(atom: InternalAtom<any>): boolean {
      return atom._update();
    },
    notify(effect: Effect): void {
      queuedEffects[queuedEffectsLength++] = effect;
      effect.flags &= ~ReactiveFlags.Watching;
    },
    unwatched(atom: InternalAtom<any>): void {
      if (atom.depsTail !== undefined) {
        atom.depsTail = undefined;
        atom.flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty;
        purgeDeps(atom);
      }
    }
  });

let notifyIndex = 0;
let queuedEffectsLength = 0;
let activeSub: ReactiveNode | undefined;

function purgeDeps(sub: ReactiveNode) {
  const depsTail = sub.depsTail;
  let dep = depsTail !== undefined ? depsTail.nextDep : sub.deps;
  while (dep !== undefined) {
    dep = unlink(dep, sub);
  }
  scheduleObservedNode?.(sub as ObservedNode);
}

function flush(): void {
  let didThrow = false;
  let firstError: unknown;
  try {
    while (notifyIndex < queuedEffectsLength) {
      const effect = queuedEffects[notifyIndex]!;
      queuedEffects[notifyIndex++] = undefined;
      try {
        effect.notify();
      } catch (error) {
        effect.flags |= ReactiveFlags.Watching | ReactiveFlags.Recursed;
        if (!didThrow) {
          didThrow = true;
          firstError = error;
        }
      }
    }
  } finally {
    notifyIndex = 0;
    queuedEffectsLength = 0;
  }
  if (didThrow) {
    throw firstError;
  }
}

/** The current state of an async atom. */
export type AsyncAtomState<Data, Error = unknown> =
  | { status: 'pending' }
  | { status: 'done'; data: Data }
  | { status: 'error'; error: Error };

/** Options passed to an async atom getter. */
export interface AsyncAtomOptions {
  /** Signal aborted when the async atom recomputes before this run settles. */
  signal: AbortSignal;
}

function updateAtomSnapshot<T>(
  atom: InternalAtom<T>,
  nextValue: T,
  compare: (previous: T, next: T) => boolean = Object.is
): void {
  // Settling changes the value without recollecting the getter's dependencies.
  if (!compare(atom._snapshot, nextValue)) {
    atom._snapshot = nextValue;
    const subs = atom.subs;
    if (subs !== undefined) {
      propagate(subs);
      shallowPropagate(subs);
      atomOperation(flush);
    }
  }
}

/**
 * Creates a read-only atom whose value is loaded from an async getter.
 *
 * The getter receives an `AbortSignal`; when the async atom recomputes, the
 * previous signal is aborted and stale resolutions are ignored.
 */
export function createAsyncAtom<T>(
  getValue: (options: AsyncAtomOptions) => Promise<T>,
  options?: AtomOptions<AsyncAtomState<T>>
): ReadonlyAtom<AsyncAtomState<T>> {
  const ref: { current?: InternalAtom<AsyncAtomState<T>> } = {};
  let currentController: AbortController | undefined;
  let currentRunId = 0;

  const atom = createAtom<AsyncAtomState<T>>(() => {
    currentController?.abort();

    const controller = new AbortController();
    const runId = ++currentRunId;
    currentController = controller;

    const reportError = (error: unknown) => {
      if (runId !== currentRunId || controller.signal.aborted) {
        return;
      }
      const errorState: AsyncAtomState<T> = {
        status: 'error',
        error: error as Error
      };
      try {
        updateAtomSnapshot(ref.current!, errorState, options?.compare);
      } catch {
        // Error delivery must not create another discarded rejection. If the
        // comparator failed before publication, publish without it once.
        if (
          runId === currentRunId &&
          !controller.signal.aborted &&
          ref.current!._snapshot !== errorState
        ) {
          try {
            updateAtomSnapshot(ref.current!, errorState);
          } catch {
            // The error snapshot is committed before notifying observers.
          }
        }
      }
    };

    getValue({ signal: controller.signal })
      .then((data) => {
        if (runId !== currentRunId || controller.signal.aborted) {
          return;
        }
        updateAtomSnapshot(
          ref.current!,
          { status: 'done', data },
          options?.compare
        );
      }, reportError)
      .catch(reportError);

    return { status: 'pending' } satisfies AsyncAtomState<T>;
  }, options);
  ref.current = atom as unknown as InternalAtom<AsyncAtomState<T>>;

  return atom;
}

/**
 * Creates an atom.
 *
 * Pass a value for a writable atom or a getter for a computed read-only atom.
 */
export function createAtom<T>(
  getValue: (prev?: T) => T,
  options?: AtomOptions<T>
): ReadonlyAtom<T>;
export function createAtom<T>(
  initialValue: T,
  options?: AtomOptions<T>
): Atom<T>;
export function createAtom<T>(
  valueOrFn: T | ((prev?: T) => T),
  optionsOrInput?: AtomOptions<T>
): Atom<T> | ReadonlyAtom<T> {
  const isComputed = typeof valueOrFn === 'function';
  const getter = valueOrFn as (prev?: T) => T;

  // Create plain object atom
  const atom: InternalAtom<T> = {
    _snapshot: isComputed ? undefined! : valueOrFn,

    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: isComputed ? ReactiveFlags.None : ReactiveFlags.Mutable,

    get(): T {
      if (activeSub !== undefined) {
        link(atom, activeSub, cycle);
      }
      return atom._snapshot;
    },

    subscribe(observerOrFn: Observer<T> | ((value: T) => void)) {
      const observer =
        typeof observerOrFn === 'function'
          ? { next: observerOrFn }
          : observerOrFn;
      const observed = { current: false };
      let e: Effect | undefined;
      try {
        atomOperation(() => {
          e = effect(() => {
            atom.get();
            if (!observed.current) {
              observed.current = true;
            } else {
              const prevSub = activeSub;
              activeSub = undefined;
              try {
                observer.next?.(atom._snapshot);
              } finally {
                activeSub = prevSub;
              }

              // If the observer synchronously updates any of our deps we'll be
              // marked as dirty preventing this effect from re-running. Request
              // the value again to reconcile any dirty deps.
              atom.get();
            }
          });
        });
      } catch (error) {
        if (e) {
          atomOperation(() => e!.stop());
        }
        throw error;
      }

      return {
        unsubscribe: () => atomOperation(() => e!.stop())
      };
    },
    _update(getValue?: T | ((snapshot: T) => T)): boolean {
      const prevSub = activeSub;
      const compare = optionsOrInput?.compare ?? Object.is;
      activeSub = isComputed ? atom : undefined;
      ++cycle;
      atom.depsTail = undefined;
      if (isComputed) {
        atom.flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;
      }
      try {
        const oldValue = atom._snapshot;
        const newValue =
          typeof getValue === 'function'
            ? (getValue as (snapshot: T) => T)(oldValue)
            : getValue === undefined && isComputed
              ? getter(oldValue)
              : getValue!;
        if (oldValue === undefined || !compare(oldValue, newValue)) {
          atom._snapshot = newValue;
          return true;
        }
        return false;
      } finally {
        activeSub = prevSub;
        if (isComputed) {
          atom.flags &= ~ReactiveFlags.RecursedCheck;
        }
        purgeDeps(atom);
      }
    }
  };

  if (isComputed) {
    atom.flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty;
    atom.get = function (): T {
      return atomOperation(() => {
        const flags = atom.flags;
        if (
          flags & ReactiveFlags.Dirty ||
          (flags & ReactiveFlags.Pending && checkDirty(atom.deps!, atom))
        ) {
          if (atom._update()) {
            const subs = atom.subs;
            if (subs !== undefined) {
              shallowPropagate(subs);
            }
          }
        } else if (flags & ReactiveFlags.Pending) {
          atom.flags = flags & ~ReactiveFlags.Pending;
        }
        if (activeSub !== undefined) {
          link(atom, activeSub, cycle);
        }
        return atom._snapshot;
      });
    };
  } else {
    (atom as unknown as Atom<T>).set = function (
      valueOrFn: T | ((prev: T) => T)
    ): void {
      atomOperation(() => {
        if (atom._update(valueOrFn)) {
          const subs = atom.subs;
          if (subs !== undefined) {
            propagate(subs);
            shallowPropagate(subs);
            flush();
          }
        }
      });
    };
  }

  return atom as unknown as Atom<T> | ReadonlyAtom<T>;
}

/**
 * Creates a read-only atom backed by an external snapshot source.
 *
 * The listener is shared by direct and derived subscriptions. Plain reads do
 * not subscribe; the last consumer leaving synchronously releases the listener.
 */
export function createSourceAtom<T>(
  source: SourceAtomConfig<T>,
  options?: AtomOptions<T>
): ReadonlyAtom<T> {
  observeNode = observe;
  scheduleObservedNode = (node) => {
    if (node._observers || node._observedDeps) {
      pendingObservedNodes.add(node);
    }
  };
  settleObservedGraph = settleSources;

  const atom = createAtom<T>(
    undefined as T,
    options
  ) as unknown as InternalAtom<T>;
  const get = atom.get;
  let initialized = false;
  let currentRun: object | undefined;
  let subscription: Subscription | undefined;

  const readSnapshot = (): T => {
    const previous = activeSub;
    activeSub = undefined;
    try {
      return source.getSnapshot();
    } finally {
      activeSub = previous;
    }
  };
  const refresh = (): void => {
    const value = readSnapshot();
    if (!initialized) {
      initialized = true;
      atom._snapshot = value;
    } else {
      updateAtomSnapshot(atom, value, options?.compare);
    }
  };

  atom.get = () =>
    atomOperation(() => {
      if (!currentRun) {
        refresh();
      }
      return get.call(atom);
    });
  atom._activate = () => {
    if (currentRun) {
      return;
    }
    const run = {};
    currentRun = run;
    let subscribing = true;
    const previous = activeSub;
    activeSub = undefined;
    try {
      // Attach before reading, so changes during registration cannot be lost.
      const result = source.subscribe(() => {
        if (currentRun === run && !subscribing) {
          atomOperation(refresh);
        }
      });
      subscription =
        typeof result === 'function' ? { unsubscribe: result } : result;
      subscribing = false;
      refresh();
    } catch (error) {
      currentRun = undefined;
      const release = subscription;
      subscription = undefined;
      release?.unsubscribe();
      throw error;
    } finally {
      activeSub = previous;
    }
  };
  atom._deactivate = () => {
    currentRun = undefined;
    const release = subscription;
    subscription = undefined;
    release?.unsubscribe();
  };

  return {
    get: atom.get.bind(atom),
    subscribe: atom.subscribe.bind(atom)
  };
}

/**
 * Creates an inert atom config that can be instantiated later.
 *
 * Useful for framework hooks that need to create a stable local atom from
 * component input.
 */
export function createAtomConfig<T, TInput>(
  getInitialValue: (input: TInput) => T,
  options?: AtomOptions<T>
): AtomConfig<T, TInput>;
export function createAtomConfig<T>(
  initialValue: T,
  options?: AtomOptions<T>
): AtomConfig<T, undefined>;
export function createAtomConfig<T, TInput>(
  initialValueOrFn: T | ((input: TInput) => T),
  options?: AtomOptions<T>
): AtomConfig<T, TInput | undefined> {
  return {
    createAtom(input?: TInput) {
      const initialValue =
        typeof initialValueOrFn === 'function'
          ? (initialValueOrFn as (input: TInput) => T)(input as TInput)
          : initialValueOrFn;

      return createAtom(initialValue, options);
    }
  };
}

/** Creates an atom whose updates are handled by a reducer function. */
export function createReducerAtom<TState, TEvent>(
  initialValue: TState,
  reducer: (state: TState, event: TEvent) => TState,
  options?: AtomOptions<TState>
): ReducerAtom<TState, TEvent> {
  const atom = createAtom(initialValue, options);

  return {
    get: atom.get.bind(atom),
    subscribe: atom.subscribe.bind(atom),
    send(event) {
      const prevSub = activeSub;
      activeSub = undefined;
      let nextState: TState;
      try {
        nextState = reducer(atom.get(), event);
      } finally {
        activeSub = prevSub;
      }
      atom.set(nextState);
    }
  };
}

interface Effect extends ObservedNode {
  notify(): void;
  stop(): void;
}

function effect<T>(fn: () => T): Effect {
  let stopped = false;
  const run = (): T => {
    const prevSub = activeSub;
    activeSub = effectObj;
    ++cycle;
    effectObj.depsTail = undefined;
    effectObj.flags = ReactiveFlags.Watching | ReactiveFlags.RecursedCheck;
    try {
      return fn();
    } finally {
      activeSub = prevSub;
      if (stopped) {
        effectObj.flags = ReactiveFlags.None;
        effectObj.depsTail = undefined;
      } else {
        effectObj.flags &= ~ReactiveFlags.RecursedCheck;
      }
      if (!stopped && effectObj._observers === undefined) {
        observeNode?.(effectObj, 1);
      }
      purgeDeps(effectObj);
    }
  };
  const effectObj: Effect = {
    deps: undefined,
    depsTail: undefined,
    subs: undefined,
    subsTail: undefined,
    flags: ReactiveFlags.Watching | ReactiveFlags.RecursedCheck,

    notify(): void {
      if (stopped) {
        return;
      }
      const flags = this.flags;
      if (
        flags & ReactiveFlags.Dirty ||
        (flags & ReactiveFlags.Pending && checkDirty(this.deps!, this))
      ) {
        run();
      } else {
        this.flags = ReactiveFlags.Watching;
      }
    },

    stop(): void {
      if (stopped) {
        return;
      }
      stopped = true;
      if (this._observers) {
        observeNode?.(this, -1);
      }
      this.flags = ReactiveFlags.None;
      this.depsTail = undefined;
      purgeDeps(this);
    }
  };

  try {
    run();
  } catch (error) {
    effectObj.stop();
    throw error;
  }

  return effectObj;
}
