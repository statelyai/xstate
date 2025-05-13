import {
  createReactiveSystem,
  Dependency,
  Subscriber,
  SubscriberFlagsComputed,
  SubscriberFlagsDirty,
  SubscriberFlagsEffect,
  SubscriberFlagsPendingComputed
} from './alien';
import { toObserver } from './toObserver';
import {
  Atom,
  AtomOptions,
  BaseAtom,
  InternalBaseAtom,
  InternalReadonlyAtom,
  Observer,
  Readable,
  ReadonlyAtom
} from './types';

const [
  link,
  propagate,
  updateDirtyFlag,
  startTracking,
  endTracking,
  processEffectNotifications,
  processComputedUpdate
] = createReactiveSystem({
  updateComputed(computed: InternalReadonlyAtom<any>) {
    return computed._update();
  },
  notifyEffect(effect: Effect) {
    effect.notify();
    return true;
  }
});

let activeSub: Subscriber | undefined = undefined;

type AsyncAtomState<Data, Error = unknown> =
  | { status: 'pending' }
  | { status: 'done'; data: Data }
  | { status: 'error'; error: Error };

export function createAsyncAtom<T>(
  getValue: () => Promise<T>,
  options?: AtomOptions<AsyncAtomState<T>>
): ReadonlyAtom<AsyncAtomState<T>> {
  const atom = createBaseAtom<AsyncAtomState<T>, AsyncAtomState<T>>(
    () => {
      getValue().then(
        (value) => {
          atom._update({ status: 'done', data: value });
        },
        (error) => {
          atom._update({ status: 'error', error });
        }
      );

      return { status: 'pending' };
    },
    // TODO: actual promise logic, like cancelation (stopping/aborting the promise)
    (_state, nextState) => nextState,
    options
  ) as InternalBaseAtom<AsyncAtomState<T>, AsyncAtomState<T>> & Dependency;
  return atom;
}

export function createAtom<T>(
  getValue: (read: <U>(atom: Readable<U>) => U) => T,
  options?: AtomOptions<T>
): ReadonlyAtom<T>;
export function createAtom<T>(
  initialValue: T,
  options?: AtomOptions<T>
): Atom<T>;
export function createAtom<T>(
  valueOrFn: T | ((read: <U>(atom: Readable<U>) => U) => T),
  options?: AtomOptions<T>
): Atom<T> | ReadonlyAtom<T> {
  if (typeof valueOrFn !== 'function') {
    const atom = createBaseAtom<T, T>(
      typeof valueOrFn === 'function' ? (valueOrFn as () => T) : valueOrFn,
      (_state, nextState) => nextState,
      options
    ) as InternalBaseAtom<T, T> & Dependency;

    Object.assign<BaseAtom<T>, Pick<Atom<T>, 'set'>>(atom, {
      set(valueOrFn: T | ((prev: T) => T)): void {
        if (atom._update(valueOrFn)) {
          const { _subs: subs } = atom;
          if (subs) {
            propagate(subs);
            processEffectNotifications();
          }
        }
      }
    });

    return atom;
  }

  const atom = createBaseAtom<T, T>(
    valueOrFn as (read?: <U>(atom: Readable<U>) => U) => T,
    (_state, nextState) => nextState,
    options
  ) as InternalBaseAtom<T, T> & Dependency;

  return atom;
}

export function createBaseAtom<T, TEvent>(
  getInitialState: T | ((read?: <U>(atom: Readable<U>) => U) => T),
  transition: (state: T, event: TEvent) => T,
  options?: AtomOptions<T>
): Atom<T> | ReadonlyAtom<T> {
  // Create plain object atom
  const atom: InternalBaseAtom<T, TEvent> & Dependency = {
    _deps: undefined,
    _depsTail: undefined,
    _flags: SubscriberFlagsComputed | SubscriberFlagsDirty,
    _snapshot:
      typeof getInitialState === 'function' ? undefined! : getInitialState,

    // Dependency fields
    _subs: undefined,
    _subsTail: undefined,

    subscribe(observerOrFn: Observer<T> | ((value: T) => void)) {
      const obs = toObserver(observerOrFn);
      const observed = { current: false };
      const e = effect(() => {
        atom.get();
        if (!observed.current) {
          observed.current = true;
        } else {
          obs.next?.(atom._snapshot);
        }
      });

      return {
        unsubscribe: () => {
          e.stop();
        }
      };
    },
    send(event) {
      const updated = atom._update(() => transition(atom._snapshot, event));
      if (updated) {
        const { _subs: subs } = atom;
        if (subs) {
          propagate(subs);
          processEffectNotifications();
        }
      }
    },
    _update(getValue?: T | ((snapshot: T) => T)): boolean {
      const prevSub = activeSub;
      const compare = options?.compare ?? Object.is;
      // TODO: deprecate
      const read = (atom: Readable<any>) => atom.get();

      activeSub = atom as InternalReadonlyAtom<T>;
      startTracking(atom as InternalReadonlyAtom<T>);
      try {
        const oldValue = atom._snapshot;
        const newValue =
          typeof getValue === 'function'
            ? (getValue as (snapshot: T) => T)(oldValue)
            : arguments.length === 0
              ? typeof getInitialState === 'function'
                ? (
                    getInitialState as (read?: <U>(atom: Readable<U>) => U) => T
                  )(read)
                : oldValue
              : (getValue as T);
        if (oldValue === undefined || !compare(oldValue, newValue)) {
          atom._snapshot = newValue;
          return true;
        }
        return false;
      } finally {
        activeSub = prevSub;
        endTracking(atom as InternalReadonlyAtom<T>);
      }
    },
    get(): T {
      const flags = (this as unknown as InternalReadonlyAtom<T>)._flags;
      if (flags & (SubscriberFlagsPendingComputed | SubscriberFlagsDirty)) {
        processComputedUpdate(atom as InternalReadonlyAtom<T>, flags);
      }

      if (activeSub !== undefined) {
        link(atom, activeSub);
      }
      return atom._snapshot;
    }
  };

  return atom as Atom<T> | ReadonlyAtom<T>;
}

interface Effect extends Subscriber {
  notify(): void;
  stop(): void;
}

function effect<T>(fn: () => T): Effect {
  const run = (): T => {
    const prevSub = activeSub;
    activeSub = effectObj;
    startTracking(effectObj);
    try {
      return fn();
    } finally {
      activeSub = prevSub;
      endTracking(effectObj);
    }
  };
  const effectObj: Effect = {
    // Subscriber fields
    _deps: undefined,
    _depsTail: undefined,
    _flags: SubscriberFlagsEffect,

    notify(): void {
      const flags = this._flags;
      if (
        flags & SubscriberFlagsDirty ||
        (flags & SubscriberFlagsPendingComputed && updateDirtyFlag(this, flags))
      ) {
        run();
      }
    },

    stop(): void {
      startTracking(this);
      endTracking(this);
    }
  };

  run();

  return effectObj;
}
