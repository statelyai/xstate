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
  Subscription
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

interface InternalAtom<T> extends ReactiveNode {
  _snapshot: T;
  _update(getValue?: T | ((snapshot: T) => T)): boolean;
  get(): T;
  subscribe(observerOrFn: Observer<T> | ((value: T) => void)): Subscription;
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
}

function flush(): void {
  while (notifyIndex < queuedEffectsLength) {
    const effect = queuedEffects[notifyIndex]!;
    queuedEffects[notifyIndex++] = undefined;
    effect.notify();
  }
  notifyIndex = 0;
  queuedEffectsLength = 0;
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

function updateAsyncAtom<T>(
  atom: InternalAtom<AsyncAtomState<T>>,
  nextValue: AsyncAtomState<T>
): void {
  if (atom._update(nextValue)) {
    const subs = atom.subs;
    if (subs !== undefined) {
      propagate(subs);
      shallowPropagate(subs);
      flush();
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

    getValue({ signal: controller.signal }).then(
      (data) => {
        if (runId !== currentRunId || controller.signal.aborted) {
          return;
        }
        updateAsyncAtom(ref.current!, { status: 'done', data });
      },
      (error) => {
        if (runId !== currentRunId || controller.signal.aborted) {
          return;
        }
        updateAsyncAtom(ref.current!, { status: 'error', error });
      }
    );

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
      const e = effect(() => {
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

      return {
        unsubscribe: () => {
          e.stop();
        }
      };
    },
    _update(getValue?: T | ((snapshot: T) => T)): boolean {
      const prevSub = activeSub;
      const compare = optionsOrInput?.compare ?? Object.is;
      activeSub = atom;
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
    };
  } else {
    (atom as unknown as Atom<T>).set = function (
      valueOrFn: T | ((prev: T) => T)
    ): void {
      if (atom._update(valueOrFn)) {
        const subs = atom.subs;
        if (subs !== undefined) {
          propagate(subs);
          shallowPropagate(subs);
          flush();
        }
      }
    };
  }

  return atom as unknown as Atom<T> | ReadonlyAtom<T>;
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

interface Effect extends ReactiveNode {
  notify(): void;
  stop(): void;
}

function effect<T>(fn: () => T): Effect {
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
      effectObj.flags &= ~ReactiveFlags.RecursedCheck;
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
      this.flags = ReactiveFlags.None;
      this.depsTail = undefined;
      purgeDeps(this);
    }
  };

  run();

  return effectObj;
}
