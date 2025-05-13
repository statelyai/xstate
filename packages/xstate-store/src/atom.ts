import {
  createReactiveSystem,
  type ReactiveNode,
  type ReactiveFlags
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

const queuedEffects: (Effect | undefined)[] = [];
export const {
  link,
  unlink,
  propagate,
  checkDirty,
  endTracking,
  startTracking,
  shallowPropagate
} = createReactiveSystem({
  update(atom: InternalReadonlyAtom<any>): boolean {
    return atom._update();
  },
  notify(effect: Effect): void {
    queuedEffects[queuedEffectsLength++] = effect;
  },
  unwatched(atom: InternalReadonlyAtom<any>): void {
    let toRemove = atom._deps;
    if (toRemove !== undefined) {
      atom._flags = 17 as ReactiveFlags.Mutable | ReactiveFlags.Dirty;
      do {
        toRemove = unlink(toRemove, atom);
      } while (toRemove !== undefined);
    }
  }
});

let notifyIndex = 0;
let queuedEffectsLength = 0;
let activeSub: ReactiveNode | undefined;

function flush(): void {
  while (notifyIndex < queuedEffectsLength) {
    const effect = queuedEffects[notifyIndex]!;
    queuedEffects[notifyIndex++] = undefined;
    effect.notify();
  }
  notifyIndex = 0;
  queuedEffectsLength = 0;
}

type AsyncAtomState<Data, Error = unknown> =
  | { status: 'pending' }
  | { status: 'done'; data: Data }
  | { status: 'error'; error: Error };

export function createAsyncAtom<T>(
  getValue: () => Promise<T>,
  options?: AtomOptions<AsyncAtomState<T>>
): ReadonlyAtom<AsyncAtomState<T>> {
  const atom = createAtom<AsyncAtomState<T>>(() => {
    getValue().then(
      (data) => {
        atom._update({ status: 'done', data });
      },
      (error) => {
        atom._update({ status: 'error', error });
      }
    );

    return { status: 'pending' };
  }, options) as InternalReadonlyAtom<AsyncAtomState<T>>;

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
  const isComputed = typeof valueOrFn === 'function';
  const getter = valueOrFn as (read: <U>(atom: Readable<U>) => U) => T;

  // Create plain object atom
  const atom: InternalBaseAtom<T> & ReactiveNode = {
    _snapshot: isComputed ? undefined! : valueOrFn,

    _subs: undefined,
    _subsTail: undefined,
    _flags: 0 as ReactiveFlags.None,

    get(): T {
      if (activeSub !== undefined) {
        link(atom, activeSub);
      }
      return atom._snapshot;
    },

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
    _update(getValue?: T | ((snapshot: T) => T)): boolean {
      const prevSub = activeSub;
      const compare = options?.compare ?? Object.is;
      activeSub = atom as InternalReadonlyAtom<T>;
      startTracking(atom as InternalReadonlyAtom<T>);
      try {
        const oldValue = atom._snapshot;
        const read = (atom: Readable<any>) => atom.get();
        const newValue =
          typeof getValue === 'function'
            ? (getValue as (snapshot: T) => T)(oldValue)
            : getValue === undefined && isComputed
              ? getter(read)
              : getValue!;
        if (oldValue === undefined || !compare(oldValue, newValue)) {
          atom._snapshot = newValue;
          return true;
        }
        return false;
      } finally {
        activeSub = prevSub;
        endTracking(atom as InternalReadonlyAtom<T>);
      }
    }
  };

  if (isComputed) {
    Object.assign<
      BaseAtom<T>,
      Pick<InternalReadonlyAtom<T>, '_deps' | '_depsTail' | '_flags' | 'get'>
    >(atom, {
      _deps: undefined,
      _depsTail: undefined,
      _flags: 17 as ReactiveFlags.Mutable | ReactiveFlags.Dirty,
      get(): T {
        const flags = (this as unknown as InternalReadonlyAtom<T>)._flags;
        if (
          flags & (16 satisfies ReactiveFlags.Dirty) ||
          (flags & (32 satisfies ReactiveFlags.Pending) &&
            checkDirty(atom._deps!, atom))
        ) {
          if (atom._update()) {
            const subs = atom._subs;
            if (subs !== undefined) {
              shallowPropagate(subs);
            }
          }
        } else if (flags & (32 satisfies ReactiveFlags.Pending)) {
          atom._flags = flags & ~(32 satisfies ReactiveFlags.Pending);
        }
        if (activeSub !== undefined) {
          link(atom, activeSub);
        }
        return atom._snapshot;
      }
    });
  } else {
    Object.assign<BaseAtom<T>, Pick<Atom<T>, 'set'>>(atom, {
      set(valueOrFn: T | ((prev: T) => T)): void {
        if (atom._update(valueOrFn)) {
          const subs = atom._subs;
          if (subs !== undefined) {
            propagate(subs);
            shallowPropagate(subs);
            flush();
          }
        }
      }
    });
  }

  return atom as Atom<T> | ReadonlyAtom<T>;
}

interface Effect extends ReactiveNode {
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
    _deps: undefined,
    _depsTail: undefined,
    _flags: 2 satisfies ReactiveFlags.Watching,

    notify(): void {
      const flags = this._flags;
      if (
        flags & (16 satisfies ReactiveFlags.Dirty) ||
        (flags & (32 satisfies ReactiveFlags.Pending) &&
          checkDirty(this._deps!, this))
      ) {
        run();
      } else if (flags & (32 satisfies ReactiveFlags.Pending)) {
        this._flags = flags & ~(32 satisfies ReactiveFlags.Pending);
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
